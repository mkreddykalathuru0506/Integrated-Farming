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
});

export const env = EnvSchema.parse(process.env);

// Production guard: never run with a dev placeholder secret in production.
if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET.startsWith('dev_only')) {
  throw new Error('Set a strong JWT_ACCESS_SECRET in production (dev placeholder not allowed).');
}

export type Env = z.infer<typeof EnvSchema>;
