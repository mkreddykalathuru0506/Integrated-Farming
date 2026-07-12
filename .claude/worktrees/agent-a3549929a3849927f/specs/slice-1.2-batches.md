# Spec — Slice 1.2: Batch (flock) records + lifecycle stage machine

**Phase:** 1 · **Branch:** `phase-1/slice-1.2-batches` · Migration `add_batch` (pre-approved Phase 1 schema)

## User story
As an owner/manager, I want to register batches/flocks of batch-tracked species and advance them through their lifecycle stages, so production cohorts are tracked end-to-end.

## Scope
**In:** `Batch` model; CRUD under `/api/farm/batches`; **advance-to-next-stage** (forward-only state machine), **close** batch; web BatchesPanel. **Out:** mortality/movement (1.4), individuals (1.3).

## Domain rules
- Batches only for species with `trackingMode = BATCH` (else `422 SPECIES_NOT_BATCH`).
- `currentStage` defaults to the species' first stage on create. **Advance** moves to the next stage by `sequence`; no next stage → `422 NO_NEXT_STAGE`. (Forward-only; no backward.)
- `code` unique per farm; `qrCode` auto-generated (`IFM-B-…`). `initialCount ≥ 1`; `currentCount = initialCount` at create.

## Acceptance (Given/When/Then)
1. Create a **chicken batch** (species CHICKEN, code, count) → `201`; `currentStage = Chick`; `currentCount = initialCount`.
2. Batch for an **INDIVIDUAL** species (CATTLE) → `422 SPECIES_NOT_BATCH`.
3. List/detail batches; cross-farm id → `404`.
4. **Advance** Chick→Grower→Finisher OK; advancing past the last stage → `422 NO_NEXT_STAGE`.
5. **Close** sets `status = CLOSED`.
6. Writes OWNER/MANAGER; LABOUR → `403`. Duplicate code → `409`.
7. Web: add a chicken batch; see it with stage + count; advance/close (loading/empty/error, 360px, i18n).

## Tests
- **Unit:** `nextStage()` picks the smallest `sequence` greater than current; none → null.
- **Integration:** create chicken batch; CATTLE→422; advance chain + past-last→422; close; dup code→409; LABOUR→403; cross-farm→404.

## DoD
Per CLAUDE.md §2.
