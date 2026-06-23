import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.ts'],
    // Argon2 hashing can be a touch slow on cold start.
    hookTimeout: 20000,
    testTimeout: 20000,
    // Integration tests share one Postgres + use native argon2. Cap at 2 forks:
    // bounds DB connections and keeps per-process memory low (single-fork
    // occasionally crashed under cumulative load). Files use unique data → parallel-safe.
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 2 } },
  },
});
