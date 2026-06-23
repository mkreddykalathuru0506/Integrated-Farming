# Spec — Slice 1.3: Individual animals + QR/ear-tag identification

**Phase:** 1 · **Branch:** `phase-1/slice-1.3-animals` · Migration `add_animal` (pre-approved Phase 1 schema)

## User story
As an owner/manager, I want to register individual animals (cattle/buffalo) with an ear-tag and a scannable QR code, so each animal is uniquely identified and tracked.

## Scope
**In:** `Animal` model; CRUD under `/api/farm/animals`; auto QR code; ear-tag uniqueness; web AnimalsPanel with QR render. **Out:** mortality/movement (1.4), breeding/health (Phase 3).
**New dep:** `qrcode.react` (web, MIT) to render the QR label.

## Domain rules
- Animals only for `trackingMode = INDIVIDUAL` species (else `422 SPECIES_NOT_INDIVIDUAL`).
- `tagNumber` unique per farm (dup → `409`); `qrCode` auto-generated (`IFM-A-…`, globally unique).
- `currentStage` defaults to the species' first stage; `status` defaults `ACTIVE`; `sex` ∈ {MALE,FEMALE,UNKNOWN}.

## Acceptance (Given/When/Then)
1. Create a **cow** (species CATTLE, tag, sex, dob) → `201`; `qrCode` set; `currentStage = Calf`; `status = ACTIVE`.
2. Animal for a **BATCH** species (CHICKEN) → `422 SPECIES_NOT_INDIVIDUAL`.
3. Duplicate `tagNumber` in the same farm → `409`.
4. List/detail; cross-farm id → `404`; writes OWNER/MANAGER, LABOUR → `403`.
5. Web: add a cow; it appears with its **QR code** rendered (scannable) + tag/stage/status (loading/empty/error, 360px, i18n).

## Tests
- **Integration:** create cow (qrCode + Calf); CHICKEN→422; dup tag→409; cross-farm→404; LABOUR→403.

## DoD
Per CLAUDE.md §2.
