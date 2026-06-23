-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "SalesOrderLine" CASCADE;
DROP TABLE IF EXISTS "SalesOrder" CASCADE;
DROP TYPE IF EXISTS "SalesOrderStatus";
