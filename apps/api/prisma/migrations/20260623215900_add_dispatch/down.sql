-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "DispatchLine" CASCADE;
DROP TABLE IF EXISTS "Dispatch" CASCADE;
