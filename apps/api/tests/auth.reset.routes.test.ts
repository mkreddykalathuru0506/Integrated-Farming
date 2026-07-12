import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { sendOtpEmail } from '../src/notifications/mailer';

vi.mock('../src/notifications/mailer', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));
const sent = vi.mocked(sendOtpEmail);

const app = createApp();
const oldPassword = 'OldPass123!';
const newPassword = 'NewPass456!';

function uniqueEmail(): string {
  return `otp-reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@t.io`;
}

function lastCodeFor(email: string): string {
  const calls = sent.mock.calls.filter((c) => c[0] === email);
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1]![2];
}

const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('forgot → reset password (integration)', () => {
  it('resets the password, revokes all sessions, and audits', async () => {
    const email = uniqueEmail();
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, name: 'Reset Test', password: oldPassword });
    expect(reg.status).toBe(201);
    const userId = reg.body.user.id as string;

    // Two live sessions before the reset — both must die.
    const login1 = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
    const login2 = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
    expect(login1.status).toBe(200);
    expect(login2.status).toBe(200);

    const forgot = await request(app).post('/api/auth/forgot').send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body).toEqual({ ok: true, retryAfterSec: 60 });

    const code = lastCodeFor(email);
    expect(sent.mock.calls.filter((c) => c[0] === email)[0]![1]).toBe('RESET_PASSWORD');

    const reset = await request(app).post('/api/auth/reset').send({ email, code, newPassword });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ ok: true });

    // Old password rejected; new accepted.
    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email, password: newPassword });
    expect(newLogin.status).toBe(200);

    // Every pre-reset refresh token is revoked.
    for (const rt of [login1.body.refreshToken, login2.body.refreshToken]) {
      const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: rt });
      expect(refresh.status).toBe(401);
    }

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'user.password.reset', entityId: userId },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.farmId).toBeNull();
    expect(auditRow!.userId).toBe(userId);
  });

  it('rejects a reset with a wrong code and leaves the password unchanged', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ email, name: 'Reset Test', password: oldPassword });
    await request(app).post('/api/auth/forgot').send({ email });
    const code = lastCodeFor(email);
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

    const reset = await request(app).post('/api/auth/reset').send({ email, code: wrong, newPassword });
    expect(reset.status).toBe(401);
    expect(reset.body.error.code).toBe('OTP_INVALID');

    const stillOld = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
    expect(stillOld.status).toBe(200);
  });
});
