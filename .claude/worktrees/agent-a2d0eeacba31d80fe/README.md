# Integrated Farm Manager (IFM) — *Samagra Krishi*

A mobile-first command center for integrated farms in India. See [`BUILD_BRIEF.md`](./BUILD_BRIEF.md) (source of truth) and [`CLAUDE.md`](./CLAUDE.md) (working rules, stack, commands).

## Prerequisites
- Node ≥ 20 (tested on 24), pnpm 9, Docker + Docker Compose.

## Quickstart
```bash
cp .env.example .env          # fill in if needed
pnpm install                  # installs all workspaces; generates Prisma client
pnpm docker:up                # start Postgres + Redis
pnpm db:migrate               # apply migrations (dev)
pnpm db:seed                  # idempotent demo data
pnpm dev                      # api on :4000, web on :5173
```

Health check: `curl http://localhost:4000/api/health`

## Monorepo layout
```
apps/web        React + Vite + TS + Tailwind (PWA)
apps/api        Express + TS + Prisma + Zod
packages/shared shared types, Zod schemas, money (paise) helpers
```

## Common commands
| Purpose | Command |
|---|---|
| Install | `pnpm install` |
| Dev (all) | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test | `pnpm test` |
| Build | `pnpm build` |
| DB migrate (dev) | `pnpm db:migrate` |
| DB migrate (deploy) | `pnpm db:migrate:deploy` |
| DB seed (idempotent) | `pnpm db:seed` |
| DB reset (dev only) | `pnpm db:reset` |
| Local infra | `pnpm docker:up` / `pnpm docker:down` |
