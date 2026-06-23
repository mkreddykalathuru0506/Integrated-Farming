-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "TemperatureLog" CASCADE;
DROP TABLE IF EXISTS "ColdStorage" CASCADE;
DROP TYPE IF EXISTS "ProductState";
