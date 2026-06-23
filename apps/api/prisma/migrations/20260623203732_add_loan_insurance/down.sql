-- Manual DOWN (Prisma forward-only). Dev: pnpm db:reset. Prod: backup first.
DROP TABLE IF EXISTS "LoanPayment" CASCADE;
DROP TABLE IF EXISTS "Loan" CASCADE;
DROP TABLE IF EXISTS "Insurance" CASCADE;
DROP TYPE IF EXISTS "LoanStatus";
DROP TYPE IF EXISTS "InsuranceType";
DROP TYPE IF EXISTS "InsuranceStatus";
