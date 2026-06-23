-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "ScheduleTemplate" CASCADE;
DROP TYPE IF EXISTS "Frequency";
DROP TYPE IF EXISTS "TaskStatus";
DROP TYPE IF EXISTS "TaskType";
