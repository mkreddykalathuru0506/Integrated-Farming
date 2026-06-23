-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "ByproductTransfer" CASCADE;
DROP TYPE IF EXISTS "ByproductType";
