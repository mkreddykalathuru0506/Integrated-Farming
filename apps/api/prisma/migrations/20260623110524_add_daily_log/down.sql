-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "DailyLog" CASCADE;
DROP TYPE IF EXISTS "LogType";
