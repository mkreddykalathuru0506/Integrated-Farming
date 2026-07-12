# Spec — Slice 2.1: Workers + attendance

**Phase:** 2 · **Branch:** `phase-2/slice-2.1-workers` · Migration `add_worker_attendance` (pre-approved Phase 2 schema)

## User story
As an owner/manager, I want worker profiles (with wage rate) and daily attendance, so labour and payroll can build on it.

## Scope
**In:** `Worker` (wage in **paise**) + `Attendance` models; CRUD workers; mark/list daily attendance (one per worker/day, upsert). **Out:** payroll/wages calc (Phase 4), labour self-service (later).

## Domain rules
- `dailyWageRatePaise` is **integer paise** (transported as a string).
- Attendance unique per `(workerId, date)`; marking again upserts the status.
- Farm-scoped; writes OWNER/MANAGER.

## Acceptance (Given/When/Then)
1. Create a worker (name, wageType, dailyWage) → `201`; wage round-trips as paise string.
2. List workers (farm-scoped); cross-farm id → `404`.
3. Mark attendance for a worker on a date → `201/200`; re-mark same day updates status (no dupe).
4. List attendance for a date returns the marked rows.
5. LABOUR write → `403`.

## Tests
- **Integration:** create worker (wage paise), list, cross-farm 404, mark + re-mark (idempotent), LABOUR 403.

## DoD
Per CLAUDE.md §2.
