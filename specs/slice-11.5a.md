# Spec — Slice 11.5a: API read-side completeness — pagination envelope + missing reads + aggregates

**Phase:** 11 · **Branch:** `phase-11/slice-11.5a-reads-pagination` · **No migration, no web changes, no auth/RBAC/money-logic changes** — additive reads only (auto-merge sanctioned for non-§1.4 slices).

## Scope

API-only (apps/api). Split out of the Architect's spec 11.5: **§1 (pagination envelope)** and **§2 (new reads)** only. Explicitly **excluded** (deferred to the later checkpoint slice 11.5b): all lifecycle mutations (expense edit/delete, invoice mark-paid/void, customer/vendor/feed-item/asset PATCH, report-schedule pause/delete, risk resolve), the Expense soft-delete migration, and task-assignment endpoints.

### 1. Additive pagination envelope (12 list endpoints)

Shared helper `src/http/list-query.ts` (`ListQuerySchema`, `skipTake`, `envelope`, `dateRange`, `contains`). Query params (all optional): `?page&pageSize&q&status&from&to` + per-endpoint extras.

- **`page` absent → byte-identical legacy response** (same legacy key, ordering, limits). Filters still apply when given.
- **`page` present → `{ items, total, page, pageSize }`** where `items` carries the same DTO as the legacy elements; `total` counts all rows matching the filters; out-of-range page → `items: []` with the real total.
- `q` = case-insensitive contains (OR across fields); `status` validated per-entity via `z.nativeEnum` → 400 `VALIDATION` (never a Prisma error); `from/to` bound the endpoint's date column.
- Per service: shared `whereX(farmId, filter)` builder feeds both the legacy list and the paged sibling (`listXPaged`) so the two can't drift.

| endpoint | legacy key | q fields | status enum | date col | extras |
|---|---|---|---|---|---|
| `GET /api/farm/batches` | `batches` | code, name | BatchStatus | createdAt | — |
| `GET /api/farm/animals` | `animals` | tagNumber, name | AnimalStatus | createdAt | — |
| `GET /api/farm/expenses` | `expenses` | description | ExpenseCategory | occurredAt | legacy `batchId`, `category` kept |
| `GET /api/farm/invoices` | `invoices` | invoiceNumber, customer.name | InvoiceStatus | issueDate | paged DTO adds `customer:{id,name}`; legacy DTO untouched |
| `GET /api/farm/orders` | `orders` | orderNumber, customer.name | SalesOrderStatus | orderDate | — |
| `GET /api/farm/logs` | `logs` | — | — (`type` = LogType) | loggedAt | `batchId` added; legacy take-50 kept |
| `GET /api/farm/workers` | `workers` | name, phone | — (`active=true/false`) | createdAt | — |
| `GET /api/farm/customers` | `customers` | name, phone, gstin | — | createdAt | — |
| `GET /api/farm/market` | `rates` | commodity | — | observedAt | paged mode = raw observations; legacy stays latest-per-commodity |
| `GET /api/farm/alerts` | `alerts` | subject, body | NotificationStatus | createdAt | legacy take-50 kept |
| `GET /api/farm/byproducts` | `transfers` | notes | — (`type` = ByproductType) | transferredAt | — |
| `GET /api/farm/assets` | `assets` | name, code | AssetStatus | createdAt | schedules sub-select kept |

### 2. New reads (all member-readable, farm-scoped, BigInt/Decimal as strings)

1. `GET /api/farm/mortality` — legacy key `events`; item joins `batch:{id,code}` / `animal:{id,tagNumber}`; filters `batchId`, `animalId`, `type` (EventType), from/to on occurredAt; paged envelope. Router role gate moved from router-level to the POST only (write stays OWNER/MANAGER).
2. `GET /api/farm/movements` — key `movements`; same treatment; `fromUnitId`/`toUnitId` returned as plain ids (no FK by design).
3. `GET /api/farm/invoices/:id` — detail JSON: legacy DTO + `customer:{id,name,gstin,state}`, `placeOfSupplyState`, `notes`, `lines[]` (qty/paise as strings). Wrong farm → same 404.
4. `GET /api/farm/coldstorage/:id/temps?from&to&page` — additive: no params → legacy last-50 desc; from/to → bounded window (asc when `from` given), cap 1000; paged envelope. 404 via store lookup.
5. `GET /api/farm/market/history?commodity&from&to&page` — commodity required → 400 `COMMODITY_REQUIRED`; raw observations asc by observedAt; default window last 90 days; cap 1000; key `rates` / envelope.
6. `GET /api/farm/finance/summary?granularity=month&from&to` — buckets by **Asia/Kolkata** month (pure `istMonthKey`, unit-tested at midnight boundaries); default window = current Indian FY (Apr 1 IST → now); revenue = non-CANCELLED invoices, expenses, feed CONSUMPTION cost (same definition as farm P&L); BigInt math; empty months emitted with zeros.
7. `GET /api/farm/due?days=7` (1–60) — new router; composes existing logic (batched vaccination categorizer, `assets.reminders(days)`, `loans.reminders` [fixed 7/30-day windows, noted in `windows` meta], today-IST PENDING tasks). Member read (LABOUR needs today's tasks).
8. `GET /api/farm/batches/:id/performance` — reuses `feed.batchFcr` + `finance.batchCost`; adds feed/weight/mortality series (cumulative in JS), `mortalityRatePct` vs initialCount, merged desc timeline (created/movement/mortality/medication/vaccination/processing, cap 100).

## Acceptance

1. **Zero legacy breakage:** all 232 pre-existing api tests pass unedited; `page` absent returns the exact legacy shape.
2. Envelope: correct `total`/slicing; out-of-range page → empty items + real total; `pageSize` ≤ 100 enforced; invalid `status`/`type`/dates → 400 VALIDATION.
3. Farm-scoping on every new query (q-search cannot surface another farm's rows; detail reads 404 across farms).
4. Money stays integer-paise strings end-to-end in every new DTO.
5. Finance summary bucket math correct across IST month boundaries; due rollup counts match its arrays; performance math (FCR echo, cost roll-up, cumulative series, mortality rate) matches seeded fixtures.

## Tests

37 new tests across 6 files: `list-pagination` (13 — legacy shape + envelope + q/status/window + IDOR per endpoint), `mortality.movement.reads` (5), `invoice.detail.finance.summary` (7, incl. 3 pure IST unit tests), `market.history.cold.window` (5), `due.rollup` (4), `batch.performance` (3). Full suite: 269 passing.
