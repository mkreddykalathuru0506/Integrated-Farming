import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  // Optional so the server can boot for /api/health (and unit tests) without a DB.
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  // Auth. Dev default lets tests/dev run; production guard below forbids the placeholder.
  JWT_ACCESS_SECRET: z.string().min(16).default('dev_only_change_me_access_secret'),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // OTP (slice 11.3). HMAC pepper for one-time codes — dev default; production guard below.
  OTP_PEPPER: z.string().min(8).default('dev-pepper'),
  // SMTP delivery (optional). Unset SMTP_HOST → nodemailer jsonTransport (no real mail;
  // outside production the code is also logged to the console for local sign-in).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().optional(), // 'true' → TLS-on-connect (465); anything else → STARTTLS
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);

// Production guard: never run with a dev placeholder secret in production.
if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET.startsWith('dev_only')) {
  throw new Error('Set a strong JWT_ACCESS_SECRET in production (dev placeholder not allowed).');
}
if (env.NODE_ENV === 'production' && env.OTP_PEPPER === 'dev-pepper') {
  throw new Error('Set a strong OTP_PEPPER in production (dev placeholder not allowed).');
}

export type Env = z.infer<typeof EnvSchema>;
