# Spec — Slice 2.3: Daily logging (feed/eggs/weight) idempotent

**Phase:** 2 · **Branch:** `phase-2/slice-2.3-daily-logging` · Migration `add_daily_log` (pre-approved Phase 2 schema)

## User story
As a labour/field worker, I want to quickly log feed given, eggs collected, or weights, so daily production is captured — and replays (offline sync) never duplicate.

## Scope
**In:** `DailyLog` model; create (idempotent via `clientLogId`) + list; **any farm member** can log (labour included). Quick-entry web form. **Out:** offline queue/background sync (2.4 — the API here is the sync target).

## Domain rules
- `type` ∈ {FEED, EGGS, WEIGHT}; `quantity` integer + `unit` label; target = one of batch/animal/unit (validated farm-scoped).
- **Idempotency:** if `clientLogId` is supplied, a repeat with the same id returns the existing row (no duplicate) — the offline-sync contract.
- Logging is allowed for **any member** (first labour-writable endpoint).

## Acceptance (Given/When/Then)
1. Member logs feed for a batch → `201`.
2. Re-POST with the same `clientLogId` → returns the same row; total log count unchanged.
3. List logs (filter by type/date); cross-farm target → `404`/`422`.
4. LABOUR can create a log (member-level write).

## Tests
- **Integration:** create log; idempotent replay (same clientLogId, no dupe); list by type; LABOUR create OK; cross-farm batch target → 422.

## DoD
Per CLAUDE.md §2.
