# ADR-0001: Monorepo, stack, and build conventions

**Status:** Accepted · **Date:** 2026-06-22 · **Owner-approved:** Phase 0 checkpoint

## Context
The brief (§7) prescribes a React/TS + Express/TS + Postgres/Prisma + Redis stack and leaves repo layout (monorepo vs two repos) and Express-vs-NestJS to the Architect. Owner confirmed open decision #10: **Express + TypeScript, monorepo** (`/apps/web`, `/apps/api`, `/packages/shared`).

## Decisions
1. **Monorepo via pnpm workspaces.** `apps/web`, `apps/api`, `packages/shared`. pnpm chosen for fast, disk-efficient installs and first-class workspace support.
2. **Backend = Express + TypeScript** (not NestJS), per owner decision #10.
3. **`packages/shared` is source-only.** Its `exports` map points directly at `src/index.ts`. It is consumed as TypeScript source by Vite (web), tsx (api runtime), Vitest, and tsc (typecheck). No separate build artifact — eliminates build-ordering and ESM/CJS friction. It holds shared types, Zod schemas, enums, and the **integer-paise money helpers**.
4. **API runtime = tsx** (dev and prod). `build` is `tsc --noEmit` (compile-check only); the service runs `tsx src/index.ts`. Avoids a bundling step and the “.ts-at-runtime” problem for the workspace dependency. Revisit if cold-start/perf needs a compiled bundle.
5. **TypeScript config** centralised in `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `moduleResolution: Bundler`). Each package extends it.
6. **Lint/format:** ESLint flat config (v9) + typescript-eslint v8 at the root; Prettier for formatting; `eslint-config-prettier` to avoid conflicts.

## Migration reversibility (brief §1.3 “up AND down”)
Prisma generates forward SQL only. Our reversibility policy:
- **Dev:** `prisma migrate reset` recreates from scratch (data is disposable).
- **Prod:** every migration is reviewed at a checkpoint; a hand-written `down.sql` is kept alongside non-trivial migrations, and prod follows a **backup-first** rule before `migrate deploy`. Initial migration `down` = drop the created tables + enums.

## Consequences
- Simple, fast local dev; no inter-package build orchestration.
- Production runs via tsx (acceptable for our scale); documented seam to switch to a compiled bundle later.
- `RBAC Role` is modelled as a Prisma enum for Phase 0 (ADR-0002 will revisit if a permissions table is needed).
