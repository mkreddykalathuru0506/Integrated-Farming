# Spec — Slice 0.4: Farm & Unit setup (CRUD) + farm settings

**Phase:** 0 · **Branch:** `phase-0/slice-0.4-farm-unit` · **Not a §1.4 trigger** (CRUD on existing tables; end-of-slice checkpoint only)

## User story
As an **owner**, I want to create a farm, configure its compliance/locale settings, and manage its units, so that the farm structure exists for every later module to hang off.

## Scope
**In:** create farm (creator becomes OWNER); read/update farm + settings (FSSAI/GSTIN/locale placeholders, money as integer paise for GST threshold); Unit CRUD (list/create/get/update/soft-delete) scoped to the current farm; web farm-picker + settings form + units list/create; tests.
**Out:** units sub-layout (pens/coops) and unit-level manager assignment (later); buyer/portal; anything Phase 1+. **No schema change** (`Farm`, `FarmSetting`, `Unit` exist).

## Endpoints
- `POST /api/farms` — create farm (auth). Creates Farm + default FarmSetting + OWNER Membership for the caller. → `201 {farm}`.
- `GET /api/farm` — current farm + settings (member). `X-Farm-Id`.
- `PATCH /api/farm` — update farm name/state/district (**OWNER**).
- `GET /api/farm/settings` / `PUT /api/farm/settings` — read / update settings (**OWNER**). FSSAI tier ∈ {BASIC,STATE,CENTRAL}; `gstThresholdPaise` is **integer paise**, transported as a string.
- `GET /api/farm/units` — list active units (member).
- `POST /api/farm/units` — create unit (**OWNER/MANAGER**); `type` ∈ UNIT_TYPES; unique name per farm.
- `PATCH /api/farm/units/:id` — update (**OWNER/MANAGER**), farm-scoped.
- `DELETE /api/farm/units/:id` — **soft-delete** (sets `deletedAt`) (**OWNER/MANAGER**).

## Acceptance criteria (Given/When/Then)
1. **Create farm** → `201`; caller is OWNER (appears in `/api/me/farms`); a default settings row exists.
2. **Units are farm-scoped** — a unit created under farm A is **not** visible/editable via farm B's context (cross-farm `:id` access → `404`/`403`, no leak).
3. **Role-gated writes** — MANAGER can create/update units; **LABOUR cannot** (403). Settings/farm edits are OWNER-only.
4. **Unique unit name per farm** — duplicate name → `409`.
5. **Soft delete** — deleted unit disappears from the list but the row persists (`deletedAt` set).
6. **Money** — `gstThresholdPaise` stored as integer paise (BigInt), round-trips as a string; invalid (non-integer/negative) → `400`.
7. **Web** — create a farm (if none) and a unit via UI; unit appears in the list; **loading / empty / error** states; works at 360px; no hard-coded strings.

## Security / domain
- All `/api/farm/*` queries filtered by `farmScope(req)`; unit `:id` operations additionally verify the unit belongs to `req.farmId`.
- Money never a float; GST threshold is a configurable setting, never hard-coded.
- FSSAI/GSTIN remain optional placeholders.

## Tests
- **Unit:** settings DTO money (paise string ↔ BigInt) mapping; invalid paise rejected.
- **Integration:** create farm→owner; unit create/list/update/soft-delete; cross-farm unit access blocked; LABOUR write → 403; duplicate name → 409.

## DoD
Per CLAUDE.md §2. Staging deploy deferred to 0.6.
