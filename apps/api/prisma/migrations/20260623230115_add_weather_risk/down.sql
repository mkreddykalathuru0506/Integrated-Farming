-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "RiskFlag" CASCADE;
DROP TABLE IF EXISTS "WeatherReading" CASCADE;
DROP TYPE IF EXISTS "RiskStatus";
DROP TYPE IF EXISTS "RiskSeverity";
DROP TYPE IF EXISTS "RiskType";
ALTER TABLE "FarmSetting" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "FarmSetting" DROP COLUMN IF EXISTS "longitude";
