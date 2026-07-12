# Spec — Slice 3.3: Breeding records + lineage

**Phase:** 3 · **Branch:** `phase-3/slice-3.3-breeding` · Migration `add_breeding`

## Scope
`BreedingRecord` (dam/sire lineage) + `Species.gestationDays`. Auto **expected-due-date** from species gestation (override allowed); status + offspring outcome. Web breeding panel.

## Domain rules
- `expectedDueDate = input.expectedDueDate ?? (breedingDate + species.gestationDays)`; pure `addDays()` (unit-tested).
- dam/sire are farm-scoped animals (optional); species required (or inferred from dam).
- Writes = OWNER/MANAGER/VETERINARIAN.
- Seed gestation defaults (days): Cattle 283, Buffalo 310, Goat 150, Sheep 152, Rabbit 31.

## Acceptance
1. Create a breeding record for CATTLE with a breedingDate → `expectedDueDate` = +283 days (from species default).
2. Override expectedDueDate is respected.
3. Update to COMPLETED with offspringCount.
4. Cross-farm dam → 422; LABOUR create → 403.

## Tests
- **Unit:** `addDays`.
- **Integration:** create (auto due date), override, complete, LABOUR 403.
