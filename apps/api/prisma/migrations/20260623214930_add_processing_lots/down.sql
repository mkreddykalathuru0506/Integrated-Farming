-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "ProductLot" CASCADE;
DROP TABLE IF EXISTS "ProcessingRun" CASCADE;
DROP TYPE IF EXISTS "ProductLotStatus";
