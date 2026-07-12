# Spec — Slice 0.3: RBAC roles + membership + farm-scoping middleware

**Phase:** 0 · **Branch:** `phase-0/slice-0.3-rbac` · **⚠️ §1.4 checkpoint: RBAC**

## User story
As the **system**, I want every tenant request authorized by farm membership and role, so that no user can act on a farm they don't belong to or perform actions above their role.

## Scope
**In:** `requireFarmAccess` (resolves farm from **`X-Farm-Id` header** + membership → 403 on no access), `requireRole(...)` gate, `farmScope(req)` helper, `/api/me/farms`, `/api/farm/members`, per-role + second-farm idempotent seed, web display of role/farm, unit + integration tests.
**Out:** farm/unit CRUD (0.4), Prisma client-extension defense-in-depth (later hardening), unit-level manager assignment (later). **No schema change** (`Role` enum + `Membership` already exist).

## Convention (ADR-0002)
- Tenant-scoped endpoints live under **`/api/farm/*`** and require `Authorization: Bearer` + **`X-Farm-Id`** header. Middleware verifies an **ACTIVE `Membership`**, sets `req.farmId` + `req.role`.
- User-level endpoints live under `/api/me/*` (auth only, not farm-scoped).

## Acceptance criteria (Given/When/Then)

1. **Farm context required**
   - Given an authed request to `/api/farm/*` with no `X-Farm-Id`, Then `400 {error.code:"FARM_REQUIRED"}`.
2. **Membership enforced (no cross-farm / no IDOR)**
   - Given a user with no membership in farm X, When they call `/api/farm/members` with `X-Farm-Id: X`, Then `403 {error.code:"FORBIDDEN"}`.
3. **Role gate**
   - Given a `LABOUR` member, When `GET /api/farm/members`, Then `403` (OWNER/MANAGER only).
   - Given an `OWNER`/`MANAGER` member, Then `200` with the member list.
4. **My farms**
   - Given any authed user, When `GET /api/me/farms`, Then `200` with `[{farmId, farmName, role}]` for their ACTIVE memberships only.
5. **Log in as each role**
   - Seed provides one user per role on the demo farm; each can log in; access differs by role per the above.
6. **Web**
   - After login the app shows the user's **farm + role** (loading/empty/error states).

## Security
- Farm scope derived from membership, never trusted from the client beyond the farm id (which is authorized against membership).
- `farmScope(req)` throws if used without `requireFarmAccess` (guards against accidental unscoped queries).
- No new secrets; audit unchanged this slice (read-only endpoints).

## Tests
- **Unit:** `requireRole` allow/deny (403 with code FORBIDDEN).
- **Integration (DB, self-seeding):** ownerA→members 200; labourA→403; ownerB (X-Farm-Id=A)→403 (cross-farm); missing header→400; `/api/me/farms` returns only the caller's farms.

## DoD
Per CLAUDE.md §2. Staging deploy deferred to 0.6.
