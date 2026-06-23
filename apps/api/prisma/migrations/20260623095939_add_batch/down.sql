-- Manual DOWN (Prisma is forward-only). Dev: `pnpm db:reset`. Prod: backup first.
DROP TABLE IF EXISTS "Batch" CASCADE;
DROP TYPE IF EXISTS "BatchStatus";
