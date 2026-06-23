-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "MaintenanceRecord" CASCADE;
DROP TABLE IF EXISTS "MaintenanceSchedule" CASCADE;
DROP TABLE IF EXISTS "Asset" CASCADE;
DROP TYPE IF EXISTS "MaintenanceType";
DROP TYPE IF EXISTS "AssetStatus";
DROP TYPE IF EXISTS "AssetType";
