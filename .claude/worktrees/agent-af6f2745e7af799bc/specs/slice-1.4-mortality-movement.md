# Spec — Slice 1.4: Mortality/culling + movements

**Phase:** 1 · **Branch:** `phase-1/slice-1.4-mortality-movement` · Migration `add_movement_mortality` (pre-approved Phase 1 schema)

## User story
As an owner/manager, I want to record mortality/culling and move animals/batches between units, so head counts and locations stay accurate.

## Scope
**In:** `Movement`, `MortalityEvent` models; record mortality/cull; record movement; web actions on batches & animals. **Out:** batch split on move; labour daily-logging entry (Phase 2).

## Domain rules
- **Mortality/cull on a batch:** `count` must be an integer `1..currentCount` (else `422 INVALID_COUNT`); decrements `currentCount`; logs a `MortalityEvent`.
- **Mortality/cull on an animal:** sets `status` = `DEAD` (MORTALITY) or `CULLED` (CULL); only if currently `ACTIVE` (else `422 ALREADY_INACTIVE`); logs a `MortalityEvent` (count 1).
- **Move:** relocates the whole animal/batch to `toUnitId` (validated farm unit); logs a `Movement` with `fromUnitId`.
- Exactly one of `animalId`/`batchId` per event.

## Acceptance (Given/When/Then)
1. Batch mortality `count=10` on a 100-bird batch → `currentCount = 90`; event logged.
2. Batch mortality `count > currentCount` → `422 INVALID_COUNT`; count unchanged.
3. Animal cull → `status = CULLED`; second cull → `422 ALREADY_INACTIVE`.
4. Move a batch/animal to a unit → its `unit` updates; `Movement` logged with from/to.
5. Writes OWNER/MANAGER; LABOUR → `403`; cross-farm target/id → `404`/`422`.

## Tests
- **Unit:** `isValidLoss(current, loss)` (1..current integer).
- **Integration:** batch mortality decrements + over-count 422; animal cull + repeat 422; move updates unit + logs; LABOUR 403.

## DoD
Per CLAUDE.md §2. Completes Phase 1 → end-of-phase checkpoint.
