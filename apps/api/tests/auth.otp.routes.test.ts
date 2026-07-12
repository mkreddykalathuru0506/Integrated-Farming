import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { sendOtpEmail } from '../src/notifications/mailer';

// Capture delivered codes instead of sending mail. The factory replaces the module for
// everything the app imports transitively (auth/otp.ts).
vi.mock('../src/notifications/mailer', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));
const sent = vi.mocked(sendOtpEmail);

const app = createApp();
const password = 'TestPass123!';

function uniqueEmail(): string {
  return `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@t.io`;
}

/** The most recent OTP code delivered to `email` (per the mocked mailer). */
function lastCodeFor(email: string): string {
  const calls = sent.mock.calls.filter((c) => c[0] === email);
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1]![2];
}

function wrongCode(code: string): string {
  return String((Number(code) + 1) % 1_000_000).padStart(6, '0');
}

async function registerUser(email: string) {
  const res = await request(app).post('/api/auth/register').send({ email, name: 'Otp Test', password });
  expect(res.status).toBe(201);
  return res.body.user.id as string;
}

const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('OTP login (integration)', () => {
  it('request → verify issues tokens that reach a protected endpoint; code is single-use', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const reqRes = await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body).toEqual({ ok: true, retryAfterSec: 60 });

    const code = lastCodeFor(email);
    const verify = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email, purpose: 'LOGIN', code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.refreshToken).toBeTruthy();
    expect(verify.body.sessionId).toBeTruthy();
    expect(verify.body.user.email).toBe(email);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${verify.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    // Consumed — the same code must not work twice.
    const reuse = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email, purpose: 'LOGIN', code });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('OTP_INVALID');
  });

  it('rejects the correct code after 5 wrong attempts (cap)', async () => {
    const email = uniqueEmail();
    await registerUser(email);
    await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    const code = lastCodeFor(email);

    for (let i = 0; i < 5; i++) {
      const bad = await request(app)
        .post('/api/auth/otp/verify')
        .send({ email, purpose: 'LOGIN', code: wrongCode(code) });
      expect(bad.status).toBe(401);
      expect(bad.body.error.code).toBe('OTP_INVALID');
    }
    // Attempt 6 with the CORRECT code — the cap has burned the code.
    const capped = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email, purpose: 'LOGIN', code });
    expect(capped.status).toBe(401);
    expect(capped.body.error.code).toBe('OTP_INVALID');
  });

  it('rejects an expired code', async () => {
    const email = uniqueEmail();
    await registerUser(email);
    await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    const code = lastCodeFor(email);

    await prisma.otpToken.updateMany({
      where: { destination: email, purpose: 'LOGIN' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post('/api/auth/otp/verify').send({ email, purpose: 'LOGIN', code });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('resend cooldown: immediate second request returns 200 without creating a new code', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    const countBefore = await prisma.otpToken.count({ where: { destination: email, purpose: 'LOGIN' } });
    expect(countBefore).toBe(1);

    const again = await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ ok: true, retryAfterSec: 60 });
    const countAfter = await prisma.otpToken.count({ where: { destination: email, purpose: 'LOGIN' } });
    expect(countAfter).toBe(1); // no new row inside the cooldown
  });

  it('a new request after the cooldown invalidates the previous code', async () => {
    const email = uniqueEmail();
    await registerUser(email);

    await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    const code1 = lastCodeFor(email);
    // Age the first code past the 60s cooldown.
    await prisma.otpToken.updateMany({
      where: { destination: email, purpose: 'LOGIN' },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });

    await request(app).post('/api/auth/otp/request').send({ email, purpose: 'LOGIN' });
    const code2 = lastCodeFor(email);

    const rows = await prisma.otpToken.findMany({
      where: { destination: email, purpose: 'LOGIN' },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.consumedAt).not.toBeNull(); // previous code retired

    const oldTry = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email, purpose: 'LOGIN', code: code1 });
    expect(oldTry.status).toBe(401);

    const newTry = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email, purpose: 'LOGIN', code: code2 });
    expect(newTry.status).toBe(200);
  });

  it('is enumeration-proof: unknown email gets a byte-identical 200 (request + forgot)', async () => {
    const known = uniqueEmail();
    await registerUser(known);
    const unknown = uniqueEmail(); // never registered

    const knownReq = await request(app).post('/api/auth/otp/request').send({ email: known, purpose: 'LOGIN' });
    const unknownReq = await request(app)
      .post('/api/auth/otp/request')
      .send({ email: unknown, purpose: 'LOGIN' });
    expect(unknownReq.status).toBe(200);
    expect(unknownReq.text).toBe(knownReq.text); // byte-identical body

    const knownForgot = await request(app).post('/api/auth/forgot').send({ email: known });
    const unknownForgot = await request(app).post('/api/auth/forgot').send({ email: unknown });
    expect(unknownForgot.status).toBe(200);
    expect(unknownForgot.text).toBe(knownForgot.text);

    // And nothing was created (or mailed) for the unknown account.
    const rows = await prisma.otpToken.count({ where: { destination: unknown } });
    expect(rows).toBe(0);
    expect(sent.mock.calls.some((c) => c[0] === unknown)).toBe(false);
  });
});
