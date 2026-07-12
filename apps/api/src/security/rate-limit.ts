import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

/** Factory for an IP rate limiter — returns JSON in our standard error shape on 429. */
export function makeRateLimiter(opts: { windowMs: number; max: number }): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests — try again later' } });
    },
  });
}

/**
 * Auth brute-force limiter. Tight in prod/dev; effectively disabled under tests so the
 * integration suite (which logs in many times) isn't throttled.
 */
export const authLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 100000 : 10,
});

/** Production budget for OTP issuance (otp/request + forgot): 5 per 15 min per IP. */
export const OTP_REQUEST_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };

/**
 * OTP issuance limiter (slice 11.3) — these endpoints create rows and send email, so they
 * get a much tighter budget than the general auth limiter (which they ALSO pass through).
 * Effectively disabled under tests, mirroring authLimiter; the 429 behaviour is proved in
 * tests against a limiter built from OTP_REQUEST_LIMIT.
 */
export const otpRequestLimiter = makeRateLimiter({
  ...OTP_REQUEST_LIMIT,
  max: process.env.NODE_ENV === 'test' ? 100000 : OTP_REQUEST_LIMIT.max,
});
