-- Manual DOWN for prod rollback safety (Prisma migrations are forward-only).
-- Dev rollback: `pnpm db:reset`. Prod: backup first, then apply at a checkpoint.
DROP TABLE IF EXISTS "LifecycleStage" CASCADE;
DROP TABLE IF EXISTS "Breed" CASCADE;
DROP TABLE IF EXISTS "Species" CASCADE;
DROP TYPE IF EXISTS "TrackingMode";
