import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeRateLimiter } from '../src/security/rate-limit';

describe('rate limiter', () => {
  it('returns 429 once the request budget is exceeded', async () => {
    const app = express();
    app.use(makeRateLimiter({ windowMs: 60_000, max: 3 }));
    app.get('/', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const ok = await request(app).get('/');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
