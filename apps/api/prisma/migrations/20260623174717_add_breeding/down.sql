-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "BreedingRecord" CASCADE;
DROP TYPE IF EXISTS "BreedingStatus";
ALTER TABLE "Species" DROP COLUMN IF EXISTS "gestationDays";
ALTER TABLE "Species" DROP COLUMN IF EXISTS "incubationDays";
