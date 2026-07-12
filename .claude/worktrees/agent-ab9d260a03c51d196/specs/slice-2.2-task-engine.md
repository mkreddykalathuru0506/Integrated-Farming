# Spec — Slice 2.2: Schedule templates + task engine (BullMQ)

**Phase:** 2 · **Branch:** `phase-2/slice-2.2-task-engine` · Migration `add_schedule_task` (pre-approved Phase 2 schema)

## User story
As an owner/manager, I want recurring schedule templates that auto-generate daily tasks (assignable to workers, completable, with missed detection), so routine farm work is tracked.

## Scope
**In:** `ScheduleTemplate` + `Task`; idempotent task generation; assign/complete; missed-sweep; **BullMQ** daily generator (Redis) + a manual "generate now" endpoint. **Out:** full cron expressions (DAILY/WEEKLY/MONTHLY only), notifications (Phase 7).

## Domain rules
- Generation is **idempotent** per `[templateId, dueDate]` (upsert) — safe to re-run / cron + manual.
- Frequency: DAILY (every day), WEEKLY (Mondays), MONTHLY (1st). (Simplified; documented.)
- Missed sweep: `PENDING` tasks with `dueDate < today` → `MISSED`.
- Templates: OWNER/MANAGER. **Complete a task:** any farm member (labour completes work).
- BullMQ worker runs in the API process when `REDIS_URL` is set and not under test; the same generator is exposed as `POST /api/farm/tasks/generate` for on-demand + tests.

## Acceptance (Given/When/Then)
1. Create a DAILY template → `201`.
2. `POST /tasks/generate?date=YYYY-MM-DD` creates one task per due template; **re-running creates no duplicates**.
3. WEEKLY template generates only on Monday; MONTHLY only on the 1st.
4. Complete a task (any member) → `status = DONE`, `completedAt` set.
5. Generate for a past date then sweep → that PENDING task → `MISSED`.
6. Cross-farm/role rules: template write LABOUR → `403`; cross-farm task id → `404`.

## Tests
- **Unit:** `isDue(frequency, date)` for DAILY/WEEKLY/MONTHLY.
- **Integration:** create template → generate (idempotent) → list → complete; weekly/monthly due-day; missed sweep; LABOUR template create 403.

## DoD
Per CLAUDE.md §2. New deps: bullmq + ioredis (MIT).
