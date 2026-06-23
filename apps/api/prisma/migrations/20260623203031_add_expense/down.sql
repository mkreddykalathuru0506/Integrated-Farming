-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "Expense" CASCADE;
DROP TYPE IF EXISTS "ExpenseCategory";
