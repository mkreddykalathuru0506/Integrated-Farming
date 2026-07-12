# Slice 11.8a — Phase 11 review fixes

Fixes all 18 adversarially-confirmed findings from the Phase 11 review plus 3 small
API completions. Non-§1.4 (no schema migration; no auth/RBAC/money-logic change — the
API additions are additive reads + one additive response field). Auto-merge on green.

## Finding → fix → test

| # | Finding (severity) | Fix | Test |
|---|---|---|---|
| 1 | Stored XSS in AnimalsPanel QR print popup (major, security) | Rebuilt the popup DOM with `createElement`+`textContent` for user text; `innerHTML` only for the trusted qrcode.react SVG (mirrors ProcessingPanel). | `AnimalsPanel.test`: a hostile `<img onerror>` tagNumber renders as literal text, no `<img>` element, no script exec. |
| 2 | Dashboard "All time" stuck on skeleton — web expects `createdAt` the API never returns (major, contract) | API: `createdAt` added to `FARM_SELECT` (additive, ISO). Web: `useFinanceSummary` falls back to a fixed early boundary (`ALL_TIME_FROM`) and drops the `enabled` gate so 'all' always fetches. | API supertest asserts `createdAt` present + ISO; web asserts "All" fetches even when the farm payload omits `createdAt`. |
| 3 | Open-risks/due cached under 3/2 disjoint keys; acks invalidate only their own copy (major, correctness + perf) | New `api/intelligence.hooks.ts` owns ONE key per endpoint (`useOpenRisks`, `useDue`) + a canonical `useAckRisk` and `intelInvalidation()`; dashboard/ops/bell delegate to it; weather+market refresh and the sweep invalidate the canonical keys. | `intelligence.hooks.test`: acking invalidates the shared risk+due+dashboard caches. |
| 4 | Tasks/attendance "today" from the UTC day, wrong for 00:00–05:30 IST (major) | Single `todayIST()` in `lib/format`; used in Workers/Tasks/EmiInsurance panels; `health.hooks` local copy re-exports it. | `format.test`: 18:30 UTC IST-midnight rollover + 00:00–05:30 window. |
| 5 | Offline queue not farm-scoped; flush halts forever on a permanent 4xx (major) | `QueuedLog.farmId` (idb → v2, pre-v2 rows dropped); `flush(post, farmId)` scopes to the active farm; network/5xx keep-and-stop, 4xx mark `failed` and continue; failed items surface with a Discard button; queue cleared on logout. | `queue.test`: farm-scoped flush, poison-continues, network-stops, discard. `DailyLogPanel.test`: 422 parks a failed item + Discard clears it. |
| 6 | Bell/palette deep-links + dashboard/weather/orders CTAs into role-hidden sections (major + minors, i18n-ux) | Bell + palette filter destinations by `visibleSections(role)`; dashboard "Today" groups filter by role-visible section; WeatherPanel settings CTA gated to OWNER/MANAGER; OrdersPanel "Go to customers" replaced with guidance for a MANAGER (`canAddCustomer=canBill`). | Bell/palette: LABOUR sees no intelligence/finance destination; VET sees the risk item but no ack; Orders: MANAGER gets guidance not the dead CTA. |
| 7 | HealthPanel fires one withdrawal request per active batch (major, perf) | New member-readable, farm-scoped `GET /api/farm/health/withdrawals` (one query, binding med per batch + drugName); web `useActiveWithdrawals` replaces the `useQueries` loop; adds the drug-name column. | API supertest: active/elapsed split, member-read, cross-farm isolation. Web: single request drives the board + shows the drug name. |
| 8 | Invoice list silently truncated at 100 (minor) | Invoices now use `usePagedList` + a LoadMore control ("Showing N of M"). | InvoicePanel test uses the paged envelope. |
| 9 | Negative rupees pass client zod in Assets/Byproduct/Workers (minor) | Shared `lib/moneyField` `rupeeField()` (non-negative, ≤2 dp) applied to the four flagged refines. | `moneyField.test`: rejects negatives / >2 dp; optional-empty. |
| 10 | i18n gaps: risk severity enum, unitTypes hi/parity, workers.att LEAVE (minors) | WeatherPanel severity via `risk.severity.*`; `hi/unitTypes` + `unitTypes` in CORE_NS; `workers.att.LEAVE` + `chipLeave` + a separate LEAVE bucket/chip. | parity (+unitTypes, 42); Workers renders LEAVE as "On leave" and counts it separately. |
| 11 | Entry chunk 646 kB (minor, perf) | React.lazy CommandPalette (mount on first Ctrl+K / '/'); code-split non-active locale (en eager, hi dynamic `addResourceBundle`). zod/RHF left in entry. | Build delta measured (below); parity test imports both bundles directly. |
| 12 | Panels fetch entire tables client-side (major, perf) | `usePagedList` + LoadMore for expenses, logs, market (plus invoices from #8). | Panel tests updated to the `{items,total}` envelope. |
| 13 | Feed purchase vendor picker (deferred 11.6c) | Vendor Select fed by `GET /api/farm/vendors` + quick "add vendor" (`POST /api/farm/vendors`); `vendorId` flows through `usePurchaseFeed`. | FeedPanel test: attribute to existing vendor + quick-add creates then posts with the id. |
| 14 | Three parallel cross-link helpers (cleanup) | Consolidated on `SpaLink` (now also exports `goToPanel`); deleted `panelNav.ts`; migrated Orders/Processing/Dispatch + Health/Expenses plain-`<a>` empty-state links. | Existing panel tests green. |

## Bundle delta (pnpm --filter @ifm/web build, entry chunk)

- before: `654.03 kB / 207.67 kB gzip`
- after: `598.02 kB / 185.59 kB gzip` (−56.0 kB raw, −22.1 kB gzip)
- CommandPalette (~16 kB) and hi (~40 kB) are now separate chunks.

## New API surface (additive)

- `GET /api/farm/health/withdrawals` — member-readable, farm-scoped, active batch withdrawals.
- `GET /api/farm` now includes `createdAt` (ISO).
- Web now consumes `GET /api/farm/vendors` + `POST /api/farm/vendors` (already existed) for feed-purchase attribution.
