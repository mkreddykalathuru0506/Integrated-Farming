import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { otpMailContent, sendOtpEmail } from '../src/notifications/mailer';
import { hashOtpCode } from '../src/auth/otp';
import { makeRateLimiter, OTP_REQUEST_LIMIT } from '../src/security/rate-limit';

describe('otp mailer (unit)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds a plain-text mail containing the code and its validity', () => {
    const { subject, text } = otpMailContent('LOGIN', '004217');
    expect(subject).toBeTruthy();
    expect(text).toContain('004217');
    expect(text).toContain('10 minutes');
  });

  it('without SMTP_HOST it uses jsonTransport and logs the code outside production', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(sendOtpEmail('dev@t.io', 'LOGIN', '123456')).resolves.toBeUndefined();
    const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[otp]'));
    expect(line).toBe('[otp] to=dev@t.io purpose=LOGIN code=123456');
  });
});

describe('otp code hashing (unit)', () => {
  it('is a deterministic 32-byte HMAC hex and differs across codes', () => {
    const a = hashOtpCode('123456');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtpCode('123456')).toBe(a);
    expect(hashOtpCode('123457')).not.toBe(a);
  });
});

describe('otp request rate limit (unit)', () => {
  it('is configured at 5 per 15 minutes', () => {
    expect(OTP_REQUEST_LIMIT).toEqual({ windowMs: 15 * 60 * 1000, max: 5 });
  });

  it('the 6th request from the same IP gets a 429 in our error envelope', async () => {
    // Same limiter construction the app uses in production (the app-wide instance is
    // relaxed under NODE_ENV=test so the integration suite isn't throttled).
    const app = express();
    app.use(express.json());
    app.post('/api/auth/otp/request', makeRateLimiter(OTP_REQUEST_LIMIT), (_req, res) => {
      res.status(200).json({ ok: true, retryAfterSec: 60 });
    });

    for (let i = 0; i < 5; i++) {
      const ok = await request(app)
        .post('/api/auth/otp/request')
        .send({ email: 'x@t.io', purpose: 'LOGIN' });
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app)
      .post('/api/auth/otp/request')
      .send({ email: 'x@t.io', purpose: 'LOGIN' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
