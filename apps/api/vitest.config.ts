import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.ts'],
    // Argon2 hashing can be a touch slow on cold start.
    hookTimeout: 20000,
    testTimeout: 20000,
    // Integration tests share one Postgres + use native argon2. Run all files
    // sequentially in a single fork — avoids connection storms / worker crashes
    // and keeps DB state deterministic.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
