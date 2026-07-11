# Slice 11.5b — Entity lifecycles: expense soft-delete, invoice mark-paid/void, entity PATCH, schedule pause, risk resolve, task assignment

> Builder record for the lifecycle half of spec 11.5 (`spec-11.5-api-completeness.md` §3–§5;
> the read half shipped as slice 11.5a, PR #57). API-only — no web changes.
> **§1.4 checkpoint slice**: contains one schema migration (Expense soft-delete columns) and
> touches money/billing lifecycle (invoice mark-paid/void). PR is the checkpoint presentation;
> merge only on owner APPROVE.

## What shipped

### 1. Migration `20260711110512_expense_soft_delete` (the only schema change)

Two nullable columns on `Expense` — no data change, no backfill, instantly reversible:

```sql
-- migration.sql (up)
ALTER TABLE "Expense" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT;

-- down.sql
ALTER TABLE "Expense" DROP COLUMN "deletedAt";
ALTER TABLE "Expense" DROP COLUMN "updatedBy";
```

`migrations.down.test` covers it (up + non-empty down). Deliberately **no** `updatedAt
@updatedAt` (would force a backfill for zero product value; AuditLog timestamps every write).

**Where-clause sweep** — `deletedAt: null` added to every Expense read
(grep `prisma.expense.` = exhaustive):

| site | file |
|---|---|
| expense list (legacy + paged, shared `expenseWhere`) | `apps/api/src/finance/service.ts` |
| batch cost roll-up | `apps/api/src/finance/service.ts` (`batchCost`) |
| farm P&L (also feeds reports `buildSummary` financials) | `apps/api/src/invoices/service.ts` (`farmPnl`) |
| monthly finance summary (merged in PR #57 after the spec) | `apps/api/src/finance/summary.ts` |

`reports/data.ts` reads no Expense rows directly (uses `farmPnl`) — covered transitively.

### 2. Endpoints

| method + path | roles (writes) | notes |
|---|---|---|
| `PATCH /api/farm/expenses/:id` | OWNER/MANAGER/ACCOUNTANT | partial edit; `null` clears batch/unit/vendor/description; foreign batch → 422 `INVALID_TARGET`; deleted/absent → 404 |
| `DELETE /api/farm/expenses/:id` | OWNER/MANAGER/ACCOUNTANT | soft (sets `deletedAt`, `updatedBy`); `200 { ok, id }`; repeat → 404 |
| `POST /api/farm/invoices/:id/mark-paid` | OWNER/ACCOUNTANT | `ISSUED → PAID` only; `PAID` → 422 `ALREADY_PAID`; `DRAFT`/`CANCELLED` → 422 `INVALID_STATUS`; race-safe guarded `updateMany` |
| `POST /api/farm/invoices/:id/void` | OWNER/ACCOUNTANT | `ISSUED\|DRAFT → CANCELLED`; `PAID` → 422 `INVOICE_PAID`; repeat → 422 `ALREADY_CANCELLED`; number retained (numbering counts all statuses → gap-free); P&L self-corrects via existing `status != CANCELLED` filters |
| `PATCH /api/farm/customers/:id` | OWNER/MANAGER/ACCOUNTANT | rename collision → 409 `CUSTOMER_NAME_TAKEN`; edits never retro-affect issued invoices (GST snapshot) |
| `PATCH /api/farm/vendors/:id` | OWNER/MANAGER/ACCOUNTANT | 409 `VENDOR_NAME_TAKEN` |
| `PATCH /api/farm/feed/:id` | OWNER/MANAGER/ACCOUNTANT | name/unit/reorderThreshold only; strict body → `stockQty`/`lastUnitPricePaise` rejected 400; 409 `FEED_NAME_TAKEN` |
| `PATCH /api/farm/assets/:id` | OWNER/MANAGER | incl. status transitions; foreign unit → 422 `INVALID_UNIT` |
| `PATCH /api/farm/reports/schedules/:id` | OWNER/MANAGER | pause = `{ isActive: false }`; resume may set `nextRunAt` |
| `DELETE /api/farm/reports/schedules/:id` | OWNER/MANAGER | soft (`deletedAt` column pre-existed); hidden from list + `runDueReports` sweep |
| `POST /api/farm/risk/:id/resolve` | OWNER/MANAGER | `status: RESOLVED`, sets ack fields if unset (resolve implies ack); idempotent; a persisting condition may legitimately re-open the row via `raiseFlag`'s dedupe upsert |
| `GET /api/farm/tasks?assigneeId=<id\|none>` | member read | `none` = unassigned view; combines with `date`/`status` |
| `PATCH /api/farm/tasks/:id/assign` | OWNER/MANAGER | `{ workerId: string \| null }`; other-farm/inactive worker → 422 `INVALID_WORKER` |

All update/delete paths are farm-scoped with `{ id, farmId }` conditions (pre-check or guarded
`updateMany`) — wrong farm is an indistinguishable 404. All PATCH bodies are strict Zod
(unknown keys → 400 `VALIDATION`) and require at least one field (`EMPTY_UPDATE` refine).
Money stays integer paise (BigInt in DB, string on the wire). No new dependencies.
`auditWrite` at the `/api/farm` mount logs every one of these automatically
(`expenses.update/delete`, `invoices.mark-paid/void`, `customers.update`, `vendors.update`,
`feed.update`, `assets.update`, `reports.schedules` PATCH/DELETE, `risk.resolve`, `tasks.assign`).

### Task assignment needed NO migration
`Task.assignedWorkerId` (FK → Worker) pre-existed; only the filter + assign endpoint were missing.

## Acceptance evidence (tests — 27 new, all green; full suite 311)

- `tests/expense.lifecycle.test.ts` (6): PATCH edits money/category/description; empty-body 400;
  foreign batch 422; IDOR 404 + LABOUR 403; soft-delete removed from **list + batch-cost +
  farm P&L + finance summary** with exact paise totals; deleted → PATCH/DELETE 404; audit rows.
- `tests/invoice.lifecycle.test.ts` (7): ISSUED→PAID; ALREADY_PAID; PAID unvoidable
  (INVOICE_PAID); void excludes from P&L while numbering continues past the void (gap-free);
  INVALID_STATUS for DRAFT/CANCELLED mark-paid; DRAFT voidable; IDOR 404; MANAGER 403; audit row.
- `tests/entity.patch.test.ts` (4): customer/vendor/feed/asset PATCH happy paths; 409 rename
  collisions ×3; invoice GST snapshot unaffected by customer edit; feed `stockQty` rejected;
  asset INVALID_UNIT; IDOR 404s; LABOUR 403s.
- `tests/report.schedule.lifecycle.test.ts` (4): pause skips `runDueReports` (no
  NotificationLog, `lastRunAt` stays null); resume fires + advances `nextRunAt`; soft-delete
  hides from list + sweep; 404 after delete; LABOUR 403.
- `tests/risk.task.lifecycle.test.ts` (6): resolve sets RESOLVED + ack fields, idempotent,
  leaves `?status=OPEN`; IDOR/RBAC; assign/unassign + `assigneeId`/`none` filter roundtrip;
  INVALID_WORKER for another farm's worker; LABOUR can complete but not assign; audit rows.

## Rollback plan
`down.sql` is two `DROP COLUMN`s (transactional, rehearsable the 9.3 way: apply → ROLLBACK).
Reverting the code commit alone is also safe: the new columns are nullable and unread by old code.
