# Slice 11.8b — QA hardening: Brief §11 e2e journeys, webServer config, coverage gates

**Goal:** pay down the Brief §11 test debt — the four missing Playwright journeys, a
self-contained e2e harness, a domain-logic coverage gate, and web-test flake hardening.
No product code changes (one exception: none needed — selectors were resilient as-is).

## Scope

1. Playwright e2e journeys (`apps/web/e2e/`) against real servers + a seeded DB.
2. `playwright.config.ts` webServer array — `pnpm --filter @ifm/web e2e` is self-contained.
3. `e2e.yml` also runs on `pull_request` (separate, non-required, informational workflow).
4. Vitest v8 coverage gate (≥80% lines) on the pure domain-logic modules, wired into CI.
5. `vi.setConfig({ testTimeout: 20_000 })` on dialog-heavy web test files.
6. CLAUDE.md: Phase 11 status entry + §7 commands/worktree gotcha.

## Acceptance criteria

### A. Add batch (Brief §11 journey)
- **Given** the seeded owner (owner@demo.farm) is logged in
- **When** they open `/livestock/batches`, open the "Add batch" dialog, pick a species,
  enter a unique code + initial count 25 and submit
- **Then** the dialog closes and the new batch appears in the table as Active with count 25.

### B. Compliant invoice (Brief §11 journey)
- **Given** an intra-state customer (Telangana, same as the farm) exists
- **When** the owner raises an invoice with two lines at different GST rates
  (10 × ₹100 @ 5% and 5 × ₹200 @ 12%)
- **Then** the live estimate shows the intra-state split and total ₹2,170.00,
  the row appears with a sequential Indian-FY number (`INV-<FY>-####`),
  and the detail dialog shows CGST ₹85.00 + SGST ₹85.00 (no IGST), subtotal ₹2,000.00.

### C. Order → dispatch with cold-chain gate (Brief §11 journey + §6 hard rule)
- **Given** (seeded via API in test setup) a CONFIRMED sales order and an AVAILABLE
  FROZEN product lot from a clean processed batch
- **When** the owner dispatches the lot WITHOUT refrigerated transport
- **Then** the API blocks with `422 COLD_CHAIN_FAIL` and the dialog explains
  "Blocked: this load would break the cold chain" (dialog stays open)
- **When** they retry WITH refrigerated transport at −20°C
- **Then** the dispatch succeeds and the row shows "Cold chain OK" + "Refrigerated".

### D. Withdrawal block (Brief §11 journey + §6 hard rule)
- **Given** a fresh batch (seeded via API)
- **When** the owner records medication with 7 withdrawal days on it (UI), then
  attempts to process that batch into a product lot (UI)
- **Then** processing is blocked with the explanation
  "Blocked: medication withdrawal active … withdrawal period has not elapsed".

### E. Offline sync (existing journey kept passing)
- **Given** the daily-log panel now lives at `/daily/logs` (per-panel routes)
- **When** the worker goes offline, logs a feed entry, and reconnects
- **Then** the entry queues (pending badge) and flushes on reconnect (badge clears).

### F. Harness, CI, coverage, flake
- `pnpm --filter @ifm/web e2e` starts api (:4100, `NODE_ENV=test`) + web (:5190,
  `VITE_API_URL=http://localhost:4100`) itself; `reuseExistingServer` locally, never in CI.
- `e2e.yml` runs on `pull_request` with a postgres service + seeded DB; it stays a
  separate NON-required workflow so flaky browser runs can't block merges.
- `pnpm --filter @ifm/api test:coverage` reports ≥80% lines (actual: 100%) across the
  12 pure domain modules: livestock stage-machine/counts, health withdrawal, invoices
  gst, feed/finance/sales/cold/dispatch calc, byproducts circularity, intelligence
  rules, reports schedule.calc. CI runs it as a distinct step (~4s).
- 17 dialog-heavy web test files (incl. the known-flaky ExpensesPanel) carry
  `vi.setConfig({ testTimeout: 20_000 })`.
- Full monorepo gates green: typecheck, lint, test (308 api / 265 web / 3 shared), build.

## Non-goals / notes
- No product-code or schema changes; no new endpoints. Only test/config/docs/CI files
  (plus timeout lines in existing test files).
- Coverage instruments only the pure unit-test files: instrumenting the full DB-backed
  suite deterministically crashes a tinypool fork at teardown (documented in
  `apps/api/vitest.config.ts`).
- New dev dependency: `@vitest/coverage-v8` (MIT, core vitest ecosystem).
