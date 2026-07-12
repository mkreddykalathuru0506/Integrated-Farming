# Slice 11.4a — Global search + activity feed (API only)

> Sub-slice of spec 11.4 (team/activity/search). This slice ships **only** the two read-only
> API features: `GET /api/farm/search` and `GET /api/farm/audit`. The membership-management
> endpoints (§1 of the 11.4 spec) and all web work (§4) are **out of scope** here and follow
> in a later slice. No schema changes, no auth/RBAC logic changes, no new dependencies.

## Scope

### `GET /api/farm/search?q=` — global search
- **Roles:** any ACTIVE member (`requireAuth` + `requireFarmAccess`; reads are member-level
  across this codebase — search reveals nothing the list endpoints don't already).
- **Input (Zod):** `q` — trimmed string, min 2 / max 60 chars → otherwise `400 VALIDATION`.
- **Behaviour:** 8 parallel Prisma queries (`Promise.all`), each hard-scoped by `farmId`,
  case-insensitive `contains`, `deletedAt: null` on soft-deletable models, `take: 5` per type.
- **Entity set** (type → fields searched → route hint):
  | type | fields | DTO | route |
  |---|---|---|---|
  | `batch` | code, name | id, code, name, status | livestock / batches |
  | `animal` | tagNumber, name | id, tagNumber, name, status | livestock / animals |
  | `customer` | name, phone | id, name, phone | finance / invoices |
  | `vendor` | name, phone | id, name, phone | finance / feed |
  | `invoice` | invoiceNumber | id, invoiceNumber, status, issueDate, totalPaise (string) | finance / invoices |
  | `lot` | lotCode, productName | id, lotCode, productName, state, status | sales / processing |
  | `worker` | name, phone | id, name, designation | daily / workers |
  | `order` | orderNumber | id, orderNumber, status, totalPaise (string) | sales / orders |
- **Response:** `{ q, total, groups: [{ type, route: { section, panel }, items }] }` —
  empty groups omitted; BigInt paise serialized as strings (house rule).

### `GET /api/farm/audit` — activity feed
- **Roles:** OWNER, MANAGER (management surface — same gate as `GET /members`).
- **Query (Zod):** `cursor` (AuditLog.id), `limit` (1–100, default 50), `entity`, `action`,
  `userId` (exact matches), `from`/`to` (createdAt range).
- **Behaviour:** farm-scoped, newest-first (`createdAt desc, id desc`), cursor pagination
  (`take: limit + 1` → `nextCursor`). The cursor is validated against the caller's farm —
  unknown or other-farm cursor → `400 BAD_CURSOR` (deterministic, no engine-behaviour reliance).
  `AuditLog.userId` has no Prisma relation (by design), so user names resolve via one batched
  `user.findMany` mapped in JS; system rows (null userId) → `user: null`.
- **Response:** `{ items: [{ id, action, entity, entityId, ip, createdAt, user }], nextCursor }`.
- Reads are never audited (`security/audit.ts` untouched).

## Acceptance criteria (all demonstrated by integration tests)

Search (`tests/search.routes.test.ts`, 7 tests):
- [x] `q` missing / < 2 chars (incl. after trim) → `400 VALIDATION`.
- [x] All 8 entity types findable, case-insensitively, with the specified DTO fields and
      route hints; BigInt fields returned as strings; `total` = sum of items.
- [x] Partial-token match (`inv-…` prefix matches a full invoice number).
- [x] Per-type cap of 5 (7 matching batches → 5 returned).
- [x] Soft-deleted rows excluded; empty groups omitted.
- [x] Farm-scoping/IDOR: identically-named decoys on farm B never appear for farm A (and
      vice versa); cross-farm header → 403; anonymous → 401; suspended member → 403;
      LABOUR (any ACTIVE member) → 200.

Activity (`tests/activity.routes.test.ts`, 8 tests):
- [x] A real API mutation surfaces in the feed (newest first) with entity/action/entityId
      and the acting user's name resolved.
- [x] Cursor pagination walks the entire feed without overlap or skips.
- [x] Filters: entity, action, userId, from/to each narrow correctly.
- [x] System rows (null userId) → `user: null`.
- [x] Cross-farm isolation (farm B feed never contains farm A rows); cross-farm read → 403.
- [x] Another farm's row id used as cursor → `400 BAD_CURSOR`; unknown cursor → `400
      BAD_CURSOR`; out-of-range limit → `400 VALIDATION`.
- [x] RBAC: MANAGER 200, LABOUR 403, anonymous 401.

Suite: 247 api tests green (232 baseline + 15 new); typecheck/lint/build green.
