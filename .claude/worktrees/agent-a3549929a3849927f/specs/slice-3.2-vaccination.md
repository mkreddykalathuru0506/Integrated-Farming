# Spec — Slice 3.2: Vaccination/deworming schedules + reminders

**Phase:** 3 · **Branch:** `phase-3/slice-3.2-vaccination` · Migration `add_vaccination`

## Scope
`VaccinationScheduleItem` (seeded per-species templates, `isSystemDefault`) + `VaccinationEvent` (doses given). Compute a batch's **due/upcoming/done** vaccinations from its age; recording a dose moves it to done. Web vaccination panel.

## Domain rules
- A schedule item is **due** when `batchAgeDays >= ageDays` and not yet recorded; **upcoming** if not yet reached; **done** if a matching `VaccinationEvent` exists. Pure `categorizeVaccinations()` (unit-tested).
- Batch age = `now - (acquiredAt ?? createdAt)`.
- Seed poultry templates (Chicken): Marek's d1, Ranikhet/NDV d7, IBD/Gumboro d14, NDV booster d28, Fowl Pox d42.
- Writes (record a dose) = OWNER/MANAGER/VETERINARIAN.

## Acceptance
1. A 30-day-old chicken batch shows **overdue** vaccinations (Marek's/NDV/IBD/NDV-booster) in `due`.
2. Recording a dose for a vaccine moves it from `due` → `done`.
3. A future-age vaccine is `upcoming`.
4. Cross-farm batch → 404/422; LABOUR record → 403.

## Tests
- **Unit:** `categorizeVaccinations` (due/upcoming/done).
- **Integration:** aged batch due-list non-empty; record → moves to done; LABOUR 403.
