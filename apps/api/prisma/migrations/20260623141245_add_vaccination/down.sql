-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "VaccinationEvent" CASCADE;
DROP TABLE IF EXISTS "VaccinationScheduleItem" CASCADE;
