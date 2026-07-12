# Slice 11.7 — Dashboard & proactive intelligence

Span: api + web. **No schema changes, no auth/RBAC-system changes, no money-logic changes** → non-§1.4, auto-merge on green per standing owner directive.

## Goal

Upgrade the rule engine from "reactive single-signal" to "proactive, actionable, localized" and rebuild the
dashboard from hand-rolled fetches into the TanStack-Query kit with a new-farm onboarding experience,
a "Today" panel, a server-driven finance trend and role-aware ordering.

## API

### 1. THI heat-stress upgrade (`intelligence/rules.ts`)

- **Given** a weather observation with humidity present, **when** the heat rule runs, **then** it computes
  `THI = 0.8·T + (RH/100)·(T − 14.4) + 46.4` and bands it — cattle: alert ≥75 / danger ≥79 / emergency ≥84;
  poultry: alert ≥72 / danger ≥78 (sources documented in code) — severity WARNING for alert, CRITICAL for
  danger/emergency.
- **Then** the stored `RiskFlag.reason` contains the THI value **and an actionable recommendation**
  (ventilation / water / feeding-time advice), composed server-side in the farm's `defaultLocale`
  (en/hi) from a tiny hardcoded per-band translation map (documented; no server i18next).
- **Given** humidity is absent, **then** the existing `heatStressRisk` temperature-only rule still applies.
- Unit tests cover every band × both locales + the fallback.

### 2. Mortality-spike rule

- Pure `mortalitySpikeRisk({ deaths24h, currentCount, batchCode, locale })` → WARNING when 24-h deaths
  exceed 2 % of the batch (pre-death population = `currentCount + deaths24h`), CRITICAL above 5 %;
  reason includes the numbers + batch code (en/hi).
- Evaluated inside `recordMortality` (batch path, type MORTALITY) **after** the transaction, isolated
  (a rule failure never fails the mortality write); upsert by dedupeKey `MORTALITY_SPIKE:<batchId>:<day>`
  (one open flag per batch per day), `type: OTHER` (no schema change).
- Integration: above-threshold mortality → flag appears; below-threshold → none.

### 3. Proactive weather sweep

- `runIntelligenceSweep(farmId, { provider?, force? })` in `intelligence/service.ts`: fetch weather via the
  provider factory (daily-cached; injectable for tests), upsert heat/THI flags, then call the existing
  **idempotent** alert dispatcher for OPEN **CRITICAL** flags (`dispatchAlerts` gains an optional
  severity filter — backward compatible).
- `sweepAllFarms()` loops every farm with lat/lon set (per-farm failure isolation).
- `jobs/intelligence-engine.ts`: BullMQ repeatable `intelligence-sweep`, daily **05:30 IST**
  (`pattern '30 5 * * *'`, `tz Asia/Kolkata`), no-op without REDIS_URL — same pattern as task/report engines;
  queue wiring not integration-tested (CI has no Redis), the sweep body is.
- `POST /api/farm/intelligence/sweep` (OWNER/MANAGER) runs it on demand with `force` (web Refresh + demos).

### 4. Onboarding endpoint

- `GET /api/farm/onboarding` (any member) → `{ steps: { units|batches|workers|dailyLogs|invoices: { done } },
  completedCount, total }` via cheap `count()`s.
- Integration: fresh farm → 0/5; after creating a unit + batch → those steps flip to done.

## Web — `farm/Dashboard.tsx` rebuild (Harvest look retained)

1. All reads via TanStack Query (`api/dashboard.hooks.ts`, farmKeys); sectioned skeletons
   (StatSkeleton/CardSkeleton); real error states with Retry; never fake-empty on error.
2. **Onboarding checklist card** from `/api/farm/onboarding`: per-step check/CTA deep links
   (units, batches, workers, logs, invoices), progress bar, dismiss (X) persisted to
   `localStorage['ifm.onboarding.dismissed.<farmId>']`, auto-hidden at 100 % (owners/managers only).
3. **Today panel** from `/api/farm/due?days=7`: grouped rows (vaccinations, tasks today, EMI,
   insurance, maintenance) with severity badges + deep links; friendly all-clear empty state.
4. **Finance trend**: period selector (This month / This FY / All) → `/api/farm/finance/summary`;
   Recharts revenue-vs-cost bars by month + period profit hero (fmtInrCompact); replaces the old
   client-side all-expenses aggregation. Money stays integer-paise strings; charts are display-only.
5. **Role-aware ordering** (role passed through `Perms` — 2-line nav.tsx change):
   OWNER/MANAGER → profit/KPIs, risks, Today, finance, charts; LABOUR → Today + quick-log links first,
   finance hidden; ACCOUNTANT → finance + invoice/expense links first.
6. KPI cards + risk rows deep-link; themed Recharts tooltip (card tokens, wrapped once);
   "view all" links to /intelligence/weather + /intelligence/market; weather card shows a MOCK badge
   when `source=mock` and an OWNER/MANAGER refresh action calling the sweep endpoint.
7. i18n: every new string in `dashboard` namespace, en + hi (parity test enforced).

## Acceptance evidence

- api: typecheck/lint/test/build green; new unit + integration tests pass.
- web: typecheck/lint/test/build green; new component tests (checklist, Today, role ordering,
  error+retry) pass; parity test green.
