-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "Attendance" CASCADE;
DROP TABLE IF EXISTS "Worker" CASCADE;
DROP TYPE IF EXISTS "AttendanceStatus";
DROP TYPE IF EXISTS "WageType";
