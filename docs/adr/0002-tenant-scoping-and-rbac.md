# ADR-0002: Tenant scoping & RBAC enforcement

**Status:** Accepted · **Date:** 2026-06-23 · **Owner-approved:** Slice 0.3 checkpoint (header approach)

## Context
The brief requires farm-scoping on every endpoint (no IDOR, no cross-farm leak, §8/§9) and role-based access (§2). Users can belong to multiple farms, so each tenant request must declare *which* farm and be authorized against the caller's membership.

## Decisions
1. **Farm context via `X-Farm-Id` header.** Tenant-scoped endpoints live under **`/api/farm/*`** and require `Authorization: Bearer` + `X-Farm-Id`. `requireFarmAccess` looks up an **ACTIVE `Membership`** for `(userId, farmId)`; missing → `403`. It sets `req.farmId` + `req.role`. Chosen over farmId-in-path so farm context is uniform across all routes and not repeated per route.
2. **User-level endpoints under `/api/me/*`** (auth only, not farm-scoped) — e.g. `GET /api/me/farms`.
3. **Role gate** via `requireRole(...roles)` after `requireFarmAccess`; insufficient role → `403 FORBIDDEN`.
4. **`farmScope(req)` helper** returns `{ farmId }` for queries and **throws** if used without `requireFarmAccess` — a guardrail against accidentally unscoped queries.
5. **Role stays a Prisma enum** (revisits ADR-0001's note): a permissions table is unnecessary while roles map 1:1 to fixed capability sets. Promote later if per-permission grants are needed.

## Enforcement model & known limits
- 0.3 enforces scoping **explicitly**: middleware sets `req.farmId`, handlers use `farmScope(req)`, and integration tests assert cross-farm/role denials.
- **Defense-in-depth (deferred):** a Prisma client-extension that injects `farmId` filters automatically, as a backstop against a handler forgetting `farmScope`. Planned for a later hardening pass.
- One role per user per farm (Phase 0). Unit-level Manager assignment deferred.

## Consequences
- Clean, uniform tenant boundary; easy to add `/api/farm/*` resources in later slices (units, animals, …).
- Clients must send `X-Farm-Id` for tenant calls (documented; the web sets it from the selected farm).
