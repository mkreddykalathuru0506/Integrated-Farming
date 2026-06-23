-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "MedicationLog" CASCADE;
DROP TABLE IF EXISTS "HealthRecord" CASCADE;
ALTER TABLE "Animal" DROP COLUMN IF EXISTS "saleReadyAt";
ALTER TABLE "Batch" DROP COLUMN IF EXISTS "saleReadyAt";
DROP TYPE IF EXISTS "HealthEventType";
