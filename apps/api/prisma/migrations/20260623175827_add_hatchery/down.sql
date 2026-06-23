-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "IncubationLog" CASCADE;
DROP TABLE IF EXISTS "HatcheryBatch" CASCADE;
DROP TYPE IF EXISTS "IncubationEventType";
DROP TYPE IF EXISTS "HatchStatus";
