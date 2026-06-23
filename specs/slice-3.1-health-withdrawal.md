# Spec — Slice 3.1: Health records + medication + withdrawal gate

**Phase:** 3 · **Branch:** `phase-3/slice-3.1-health-withdrawal` · Migration `add_health_medication` (pre-approved Phase 3 schema) · ⚠️ compliance domain logic

## User story
As a vet/manager, I want to record health events and medications, so that an animal/batch under a drug withdrawal period is **blocked from being marked sale-ready** until it clears (FSSAI compliance, Brief §3).

## Scope
**In:** `HealthRecord` + `MedicationLog`; `Animal/Batch.saleReadyAt`; record health/medication (OWNER/MANAGER/**VETERINARIAN**); withdrawal status; **sale-ready gate** (OWNER/MANAGER). **Out:** vaccination schedules (3.2), breeding (3.3), hatchery (3.4), automated reminders (Phase 7).

## Domain rules
- Recording a medication with `withdrawalDays` sets `withdrawalUntil = administeredAt + withdrawalDays`.
- `isUnderWithdrawal(meds, now)` = any med with `withdrawalUntil > now` (pure, unit-tested).
- **Sale-ready is blocked** (`422 WITHDRAWAL_ACTIVE`) while under withdrawal; otherwise sets `saleReadyAt`.
- Health/medication targets a farm-scoped animal or batch (exactly one).

## Acceptance (Given/When/Then)
1. Record a health record (CHECKUP) for a batch → `201`.
2. Record a medication with `withdrawalDays=7` → `withdrawalUntil` ~7 days out; withdrawal status = under withdrawal.
3. **Mark sale-ready while under withdrawal → `422 WITHDRAWAL_ACTIVE`.**
4. A medication already elapsed (administeredAt in the past, short withdrawal) → not under withdrawal → mark sale-ready `200`.
5. VET can record health/medication; LABOUR cannot (`403`). Cross-farm target → `422`.

## Tests
- **Unit:** `isUnderWithdrawal` (active vs elapsed vs none).
- **Integration:** health record; medication sets withdrawal; **sale-ready blocked (422)**; after an already-elapsed med, sale-ready OK; VET can record, LABOUR 403.

## DoD
Per CLAUDE.md §2.
