-- CreateEnum
CREATE TYPE "ByproductType" AS ENUM ('LITTER', 'MANURE', 'COMPOST', 'SLURRY', 'EGGSHELL', 'SLAUGHTER_WASTE', 'CROP_RESIDUE', 'OTHER');

-- CreateTable
CREATE TABLE "ByproductTransfer" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "byproductType" "ByproductType" NOT NULL,
    "fromUnitId" TEXT,
    "sourceBatchId" TEXT,
    "toUnitId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "creditPaise" BIGINT NOT NULL DEFAULT 0,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ByproductTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ByproductTransfer_farmId_idx" ON "ByproductTransfer"("farmId");

-- AddForeignKey
ALTER TABLE "ByproductTransfer" ADD CONSTRAINT "ByproductTransfer_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
