# Spec — Slice 1.1: Species / Breed / Lifecycle reference + species page

**Phase:** 1 · **Branch:** `phase-1/slice-1.1-species-reference` · **Migration:** `add_species_breed_lifecycle` (shown before apply)

## User story
As an **owner/manager**, I want a per-farm catalogue of species (with their tracking mode), breeds, and lifecycle stages, so later slices can attach batches/animals to a known, customizable reference set.

## Scope
**In:** `Species`, `Breed`, `LifecycleStage` (farm-scoped, `isSystemDefault`); idempotent seed of 10 system-default species + default breeds + stage templates; `GET /api/farm/species`, `GET /api/farm/species/:id` (with breeds + stages); create custom species/breed (OWNER/MANAGER); species page on web.
**Out:** Batch (1.2), Animal (1.3), mortality/movement (1.4). Editing/soft-deleting system defaults beyond add (later if needed).

## Reference data (system defaults, owner-editable)
| Species | code | tracking | sample stages |
|---|---|---|---|
| Chicken | CHICKEN | BATCH | Chick → Grower → Finisher |
| Quail | QUAIL | BATCH | Chick → Grower → Adult |
| Duck | DUCK | BATCH | Duckling → Grower → Adult |
| Turkey | TURKEY | BATCH | Poult → Grower → Adult |
| Rabbit | RABBIT | BATCH | Kit → Grower → Adult |
| Goat | GOAT | BATCH | Kid → Grower → Adult |
| Sheep | SHEEP | BATCH | Lamb → Grower → Adult |
| Cattle | CATTLE | INDIVIDUAL | Calf → Heifer → Adult |
| Buffalo | BUFFALO | INDIVIDUAL | Calf → Heifer → Adult |
| Mushroom | MUSHROOM | BATCH | Spawn → Pinning → Harvest |

Stage `sequence` ascending; the last stage of each list flagged `isTerminal`.

## Acceptance criteria (Given/When/Then)
1. **Seed (idempotent)** — running seed creates the 10 species + breeds + stages marked `isSystemDefault`; re-running changes nothing and does not clobber user edits.
2. **List** — `GET /api/farm/species` (member) returns the farm's species with `code, name, trackingMode`.
3. **Detail** — `GET /api/farm/species/:id` returns the species + ordered `stages` + `breeds`; cross-farm id → 404.
4. **Create custom** — OWNER/MANAGER `POST /api/farm/species` adds a species (unique `code` per farm; dup → 409); LABOUR → 403.
5. **Web** — species page lists species with a tracking-mode badge; click → detail with stages; loading/empty/error; 360px; i18n (no hard-coded strings).

## Security / domain
- All queries `farmScope(req)`; writes OWNER/MANAGER.
- New farms get defaults auto-seeded on creation; existing farms via the seed script.

## Tests
- **Unit:** species create schema validation (code normalization/uniqueness shape).
- **Integration:** seed → list returns 10; detail includes stages ordered; cross-farm 404; LABOUR create → 403; duplicate code → 409.

## DoD
Per CLAUDE.md §2 (staging deploy criterion satisfied at phase level; this slice deploys via the existing pipeline).
