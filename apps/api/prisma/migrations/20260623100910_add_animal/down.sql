-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "Animal" CASCADE;
DROP TYPE IF EXISTS "AnimalStatus";
DROP TYPE IF EXISTS "Sex";
