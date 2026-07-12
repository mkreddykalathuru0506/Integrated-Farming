# Slice 11.9 — Final wiring: approved auth/team/lifecycle capability into the UI

**Status:** implemented (web-only; API read for contracts, untouched)
**Branch:** `phase-11/slice-11.9-approved-wiring`
**Depends on merged, owner-APPROVED PRs:** OTP auth #55 + #62, membership lifecycle #58, entity lifecycles #60.
**Also owner-approved:** deletion of dead `apps/web/src/farm/DashboardPanel.tsx`.

## Goal

Every endpoint the owner approved at the Phase-11 checkpoints becomes reachable from the UI,
and every `// 11.6 follow-up: … PR #60` deferral marker is removed by wiring the real thing.

## Stories & acceptance criteria

### 1. Team panel (`settings → team`, new `TeamPanel.tsx`)
- **Given** I open Settings → Team as any OWNER/MANAGER, **then** I see the members roster
  (name, email, role badge, status badge) from `GET /api/farm/members`.
- **Given** I am the OWNER, **when** I add a member by email + role, **then** `POST /api/farm/members`
  fires and the roster refreshes; `USER_NOT_FOUND` → "No account with this email — ask them to
  register first"; `ALREADY_MEMBER` → clear message. Re-adding a suspended member reactivates them.
- **Given** I am the OWNER, **when** I change a role via the row select, **then**
  `PATCH /api/farm/members/:userId { role }` fires; `LAST_OWNER` → clear i18n explanation.
- **Given** I am the OWNER, **when** I deactivate a member, **then** a danger ConfirmDialog guards
  `DELETE /api/farm/members/:userId`; `LAST_OWNER` mapped.
- **Given** I am a MANAGER, **then** the roster is read-only (no add / role select / deactivate).
- Perms: new `canManageTeam` (OWNER only) drives all management affordances.

### 2. Activity panel (`settings → activity`, new `ActivityPanel.tsx`)
- Reverse-chron feed from `GET /api/farm/audit` (OWNER/MANAGER-gated; new Perms flag
  `canViewAudit`, query disabled + friendly note for anyone else — the settings section is already
  OWNER/MANAGER-only, so the flag is defence in depth).
- Rows: entity icon (lucide), humanized action (`activity.entity.*` + `activity.verb.*` i18n maps
  with raw-string fallback), user name (or "system"), relative time (Intl.RelativeTimeFormat) with
  exact timestamp tooltip; grouped by IST day.
- Filters: entity (server-side `?entity=`) + action verb (server-side `?action=<entity>.<verb>`;
  enabled only once an entity is picked, since the API filter is exact-match).
- Cursor "Load more" via `nextCursor` (useInfiniteQuery — the audit envelope is cursor-based,
  unlike the 11.5a `?page` envelope, so `usePagedList` was adapted rather than reused).

### 3. Finance/ops lifecycle wiring (all `// … PR #60` markers removed)
- **ExpensesPanel**: pencil → prefilled edit dialog (`PATCH` category/amountPaise/description/date;
  description clearable via `null`); Trash → danger ConfirmDialog → `DELETE` (server soft-delete).
  Invalidates expenses + batch-cost + P&L + finance-summary.
- **InvoicePanel detail**: **Mark paid** (`POST /:id/mark-paid`, shown only for ISSUED) and **Void**
  (danger ConfirmDialog, shown for DRAFT/ISSUED — mirrors the API guards; `ALREADY_PAID`,
  `INVOICE_PAID`, `ALREADY_CANCELLED`, `INVALID_STATUS` map to human toasts via `errors.*`).
  Role-gated to `canBill` (OWNER/ACCOUNTANT — same as the API). Status badge updates via
  domain-prefix invalidation (list + detail + pnl + finance-summary).
- **ReportsPanel**: per-row Pause/Resume (`PATCH { isActive }`) + Delete behind danger
  ConfirmDialog (`DELETE`, soft-delete).
- **Risk Resolve**: ONE canonical mutation `useResolveRisk` in `api/intelligence.hooks.ts`
  (`POST /api/farm/risk/:id/resolve`, canonical `intelInvalidation`) wired next to Acknowledge in
  the Dashboard open-risk rows, the WeatherPanel risks table, and the NotificationBell.
- **TasksPanel**: per-row worker picker → `PATCH /tasks/:id/assign { workerId }` (`null` unassigns;
  a now-inactive assignee stays selectable so the value resolves) + assignee filter select wired to
  `?assigneeId=` including the API's literal `'none'` sentinel. `useTasks`/`useCompleteTask` keys
  now carry `assigneeId`; complete/assign invalidate the param-less tasks prefix.
- **Entity edit dialogs** (prefilled RHF, pencil per row):
  - customers — new roster list in InvoicePanel (name/state/gstin + pencil); dialog edits
    name/state/gstin/phone/address. Gated `canEditCustomers = canWriteFinance` (API allows
    OWNER/MANAGER/ACCOUNTANT — wider than `canBill`).
  - vendors — new "Vendors" tab in FeedPanel (name/gstin + pencil); dialog edits name/gstin/phone.
  - feed items — pencil on the inventory table; dialog edits name/reorderThreshold (blank → `null`
    clears the low-stock warning).
  - assets — pencil on the assets table (stopPropagation vs the row's detail dialog); dialog edits
    name/type/status.
- **API asymmetry (documented, not a bug):** customer `phone`/`address` and vendor `phone` are
  accepted by the PATCH but omitted from the list DTOs, so they cannot be prefilled; the dialogs
  send them only when typed ("Leave blank to keep the current value") — blank never wipes them.

### 4. Deletion
- `apps/web/src/farm/DashboardPanel.tsx` removed via `git rm` (owner-approved; grep confirmed zero
  imports — superseded by `farm/Dashboard.tsx` since Phase 10).

## i18n
New namespaces `team` + `activity` (en + hi, added to `CORE_NS` so the parity test enforces them),
plus en+hi additions to `nav.panels`, `expenses`, `invoices`, `reports`, `tasks`, `feed`, `assets`,
`weather`, `dashboard`, `bell`, and `errors` (ALREADY_PAID, INVOICE_PAID, ALREADY_CANCELLED,
INVALID_STATUS, LAST_OWNER, USER_NOT_FOUND, ALREADY_MEMBER, INVALID_WORKER, BAD_CURSOR).
No hard-coded strings.

## Tests
- `TeamPanel.test.tsx` (5): roster renders; add-member POST body + USER_NOT_FOUND mapping;
  change-role PATCH; deactivate confirm + LAST_OWNER mapping; read-only gating.
- `ActivityPanel.test.tsx` (4): humanized/grouped rows + system fallback; Load more cursor call;
  entity/verb filters hit the server; forbidden note.
- `ExpensesPanel.test.tsx` (+2): prefilled edit PATCH body; delete behind confirm.
- `InvoicePanel.test.tsx` (+4): mark-paid POST + PAID badge after refetch; void behind danger
  confirm + INVOICE_PAID mapping; ALREADY_PAID toast; customer edit PATCH (blank keeps
  write-only fields).
- `TasksPanel.test.tsx` (+2): assign PATCH `{ workerId }`; unassign `null` + `?assigneeId=`
  filter incl. `'none'`.
- `FeedPanel.test.tsx` (+2): feed-item edit PATCH; blank threshold → `null`.

## Out of scope / deferred
- API DTO widening (customer phone/address, vendor phone in list responses) — would remove the
  "blank keeps" hint; needs an API slice.
- Per-user audit filter (`?userId=`) and from/to date filters — the API supports them; UI ships
  entity+action first.
