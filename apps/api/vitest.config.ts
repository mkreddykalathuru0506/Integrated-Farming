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
    // Brief §11: ≥80% line coverage on the pure domain-logic modules (money
    // math, FCR, withdrawal gating, GST split, cold-chain gate, …). Scoped to
    // exactly these files — routes/services are exercised by the integration
    // tests but not coverage-gated. Run: `pnpm --filter @ifm/api test:coverage`
    // (the script pins the pure unit-test files: instrumenting the full
    // DB-backed suite deterministically crashes a tinypool fork at teardown,
    // and these modules' coverage comes from their dedicated unit tests anyway).
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/livestock/stage-machine.ts',
        'src/livestock/counts.ts',
        'src/health/withdrawal.ts',
        'src/invoices/gst.ts',
        'src/feed/calc.ts',
        'src/finance/calc.ts',
        'src/sales/calc.ts',
        'src/cold/calc.ts',
        'src/dispatch/calc.ts',
        'src/byproducts/circularity.ts',
        'src/intelligence/rules.ts',
        'src/reports/schedule.calc.ts',
      ],
      thresholds: { lines: 80 },
    },
  },
});
