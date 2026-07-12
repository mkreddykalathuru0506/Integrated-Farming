-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
-- Reverses the two nullable Expense soft-delete columns; no data change on the way up,
-- so the only loss on rollback is the values in these two columns (edit/delete markers).
ALTER TABLE "Expense" DROP COLUMN "deletedAt";
ALTER TABLE "Expense" DROP COLUMN "updatedBy";
