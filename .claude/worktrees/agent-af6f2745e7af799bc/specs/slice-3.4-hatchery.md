# Spec — Slice 3.4: Hatchery + incubation

**Phase:** 3 · **Branch:** `phase-3/slice-3.4-hatchery` · Migration `add_hatchery` · completes Phase 3

## Scope
`HatcheryBatch` + `IncubationLog`. Set eggs → **incubation timeline** (candling/lockdown/expected hatch from species `incubationDays`, Brief §6); temp/humidity logs; hatch-rate & fertility.

## Domain rules
- `incubationDays = input ?? species.incubationDays` (else `422 NO_INCUBATION_DAYS`).
- `expectedHatchDate = setDate + incubationDays`; `candlingDate = setDate + 7`; `lockdownDate = setDate + (incubationDays − 3)` (Chicken 21 → candle d7, lockdown d18).
- `hatchRate(eggCount, hatchedCount)` / fertility — pure, unit-tested (0 eggs → 0).
- Writes = OWNER/MANAGER.

## Acceptance
1. Set a chicken hatchery batch (21 incubation) → expectedHatchDate +21d, candling +7d, lockdown +18d.
2. A species without incubation days (e.g. CATTLE) → `422 NO_INCUBATION_DAYS`.
3. Add an incubation log (temp/humidity); record hatch (hatched/fertile) → hatch-rate computed.
4. LABOUR create → `403`; cross-farm id → `404`.

## Tests
- **Unit:** `hatchRate` (incl. 0 eggs).
- **Integration:** set batch computes timeline; CATTLE→422; add log; record hatch → rate; LABOUR 403.
