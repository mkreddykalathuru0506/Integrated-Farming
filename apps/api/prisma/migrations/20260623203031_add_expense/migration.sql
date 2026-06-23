-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FEED', 'LABOUR', 'MEDICINE', 'UTILITIES', 'MAINTENANCE', 'CAPITAL', 'OTHER');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "batchId" TEXT,
    "unitId" TEXT,
    "vendorId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_farmId_idx" ON "Expense"("farmId");

-- CreateIndex
CREATE INDEX "Expense_batchId_idx" ON "Expense"("batchId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
