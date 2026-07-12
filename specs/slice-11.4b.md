# Spec — Slice 11.4b: Membership lifecycle API (add / change role / deactivate)

**Phase:** 11 · **Branch:** `phase-11/slice-11.4b-members` · **No migration** · ⚠️ **§1.4 RBAC — owner checkpoint before merge** (managing memberships touches the RBAC surface)

## Scope
API only (`apps/api/src/rbac/`): `POST/PATCH/DELETE /api/farm/members` — the membership-lifecycle
portion of the Architect's 11.4 spec. No web changes; no schema changes (verified: `SUSPENDED`
already exists in `MembershipStatus`, and `requireFarmAccess` already rejects non-ACTIVE members,
so deactivation needs **zero enforcement changes**). Activity feed + global search ship separately.

## Design decisions (per Architect spec 11.4)
- **v1 attaches EXISTING users only.** Lookup by email (case-insensitive, `deletedAt: null`,
  `isActive: true`); unknown → `404 USER_NOT_FOUND` with a register-first message. No invite tokens.
- **Deactivation reuses `SUSPENDED`** (no `INACTIVE` enum value; adding one would be a migration for
  zero gain). `DELETE` → `status: 'SUSPENDED'`; the member's next `/api/farm/*` request dies 403 at
  the existing membership check. Re-adding via `POST` reactivates the same row with the new role.
- **Last-owner invariant:** a farm must always retain ≥ 1 ACTIVE OWNER. Enforced inside a
  **SERIALIZABLE transaction with P2034 retry** — under weaker isolation two concurrent demotions
  could each read "another owner exists" and both commit (write-skew), leaving the farm ownerless.
- `FarmMember` DTO gains `id` (the membership id) so the automatic `auditWrite` middleware picks it
  up as `entityId` on create. Writes return the same `FarmMember` shape as the existing GET.
- Courtesy notification on add/reactivate via `NotificationService` (mock channel, one
  `NotificationLog` row, best-effort — never fails the request; mirrors `notifications/service.ts`).

## Endpoints (all OWNER-only via `requireRole('OWNER')`; farm-scoped via `X-Farm-Id`)
| Method | Path | Success | Errors |
|---|---|---|---|
| POST | `/api/farm/members` `{email, role}` | `201 {member}` created · `200 {member}` reactivated | `404 USER_NOT_FOUND` · `409 ALREADY_MEMBER` · `400 VALIDATION` · `403/401` |
| PATCH | `/api/farm/members/:userId` `{role}` | `200 {member}` | `404 NOT_FOUND` · `422 LAST_OWNER` · `400` · `403/401` |
| DELETE | `/api/farm/members/:userId` | `200 {member}` (status SUSPENDED) | `404 NOT_FOUND` (incl. already-suspended) · `422 LAST_OWNER` · `403/401` |

## Acceptance (Given/When/Then)
1. Given a registered user, when OWNER posts their email + role, then 201 with an ACTIVE member
   carrying that role, and GET `/members` lists them.
2. Given an unregistered email, when OWNER posts it, then 404 `USER_NOT_FOUND` ("register first").
3. Given an ACTIVE member, when re-added, then 409 `ALREADY_MEMBER`.
4. Given a SUSPENDED member, when re-added with a new role, then 200, same membership row, role
   updated, status ACTIVE, and their farm access works again.
5. Given a MANAGER (or any non-OWNER), when they call any of the three writes, then 403.
6. Given the sole ACTIVE OWNER, when demoted or deleted, then 422 `LAST_OWNER`; with a second
   ACTIVE OWNER present, both succeed.
7. Given a deactivated member, when they call any `/api/farm/*` route with their still-valid token,
   then 403 FORBIDDEN; a second DELETE returns 404.
8. Given two farms, when farm A's OWNER targets farm B (X-Farm-Id), then 403; member lists never
   leak across farms.
9. Every successful write lands one `AuditLog` row (`members.create|update|delete`, entity
   `Members`) — automatic via `auditWrite`.
10. Given the only two OWNERs demoting each other concurrently, exactly one succeeds and exactly
    one ACTIVE OWNER remains (race-safe guard).

## Tests
`tests/members.routes.test.ts` — 17 integration tests (Vitest + Supertest, unique `s114b-` emails,
no `$disconnect`): all acceptance criteria above + case-insensitive email lookup + Zod validation
(bad role/email → 400) + unauthenticated 401 + audit-row polling + concurrent-demotion race.

## DoD
Per CLAUDE.md §2 (API-only slice: no UI states / 360px items). No new dependencies. No migration.
Full suite green (249 = 232 baseline + 17). **Do not merge without the §1.4 owner APPROVE.**
