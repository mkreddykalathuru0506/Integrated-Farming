-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "MortalityEvent" CASCADE;
DROP TABLE IF EXISTS "Movement" CASCADE;
DROP TYPE IF EXISTS "EventType";
