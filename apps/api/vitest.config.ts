import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Argon2 hashing can be a touch slow on cold start.
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});
