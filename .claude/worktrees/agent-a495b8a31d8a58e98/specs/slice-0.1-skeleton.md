# Spec — Slice 0.1: Repo & tooling skeleton + CI green

**Phase:** 0 (Foundation) · **Branch:** `phase-0/slice-0.1-skeleton`

## User story
As the **owner/developer**, I want a working monorepo skeleton with a live health endpoint, a rendering web shell, and a green CI pipeline, so that every later slice has a verified foundation to build on.

## Scope
**In:** pnpm monorepo (`apps/web`, `apps/api`, `packages/shared`); TS project refs; ESLint + Prettier; Docker Compose (Postgres + Redis); Prisma init with the approved Phase 0 schema + initial migration; `.env.example`; `GET /api/health`; minimal web shell; GitHub Actions CI; unit + API smoke test.
**Out:** auth (0.2), RBAC/farm-scoping (0.3), farm/unit CRUD (0.4), design system/i18n/PWA depth (0.5), staging deploy (0.6).

## Acceptance criteria (Given/When/Then — demonstrated, not asserted)

1. **Install**
   - Given a clean clone, When `pnpm install` runs, Then it completes with no error.
2. **Health endpoint**
   - Given the API is running, When I `GET /api/health`, Then I get `200` with JSON `{ status: "ok", ... }`.
   - Given a request to an unknown route, When I `GET /api/nope`, Then I get `404` with a JSON error shape.
3. **Local infra**
   - Given Docker is running, When `docker compose up -d`, Then Postgres (5432) and Redis (6379) are healthy.
4. **DB migration (approved schema)**
   - Given Postgres is up, When `pnpm db:migrate` runs, Then the 7 Phase 0 tables + enums are created via a reversible migration, and `pnpm db:seed` is idempotent (safe to re-run).
5. **Web shell**
   - Given the web dev server, When I open `/`, Then the app shell renders (no console errors) at **360px** width.
6. **Quality gates**
   - When `pnpm typecheck && pnpm lint && pnpm build && pnpm test` run, Then all pass (output captured).
7. **CI**
   - Given a pushed branch/PR, When GitHub Actions runs, Then install→typecheck→lint→test→build are **green**.

## RBAC / farm-scoping
- N/A at this slice (no endpoints touch tenant data yet). The farm-scoping middleware contract is introduced in 0.3. The health route is public by design.

## Domain rules touched
- **Money as integer paise:** `packages/shared` ships `paise` helpers (`rupeesToPaise`, `formatPaise`) with unit tests — the canonical money utilities reused everywhere later.
- Schema carries `farmId` + audit columns + soft-delete per the approved design.

## i18n
- Web shell strings routed through i18next (English) — no hard-coded copy. Keys: `app.title`, `app.tagline`, `app.health.ok`.

## UI states
- Web shell shows a basic loading→ready state; an error boundary placeholder exists (full empty/error patterns land in 0.4/0.5).

## Definition of Done (this slice)
Per CLAUDE.md §2. Staging deploy (criterion 9 of DoD) is explicitly deferred to slice 0.6; all other DoD items apply here.
