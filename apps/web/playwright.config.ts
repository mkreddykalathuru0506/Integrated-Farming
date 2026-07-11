import { defineConfig, devices } from '@playwright/test';

/**
 * Self-contained e2e run: `pnpm --filter @ifm/web e2e` starts both servers.
 *  - api: tsx on :4100 (NODE_ENV=test → no BullMQ engines, no auth rate-limit cap;
 *    DATABASE_URL comes from the root .env locally / the CI job env — dotenv-cli
 *    never overrides variables that are already set).
 *  - web: vite dev on :5190 pointed at the test api via VITE_API_URL.
 * Dedicated ports so a normal `pnpm dev` (4000/5180) can keep running alongside.
 * Prereq: migrated + seeded database (see .github/workflows/e2e.yml).
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5190);
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @ifm/api exec dotenv -e ../../.env -- tsx src/index.ts',
      url: `${API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        API_PORT: String(API_PORT),
      },
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
