-- CreateEnum
CREATE TYPE "ProductLotStatus" AS ENUM ('AVAILABLE', 'DEPLETED', 'DISCARDED');

-- CreateTable
CREATE TABLE "ProcessingRun" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "sourceBatchId" TEXT,
    "sourceAnimalId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputCount" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "qrCode" TEXT,
    "processingRunId" TEXT,
    "sourceBatchId" TEXT,
    "productName" TEXT NOT NULL,
    "state" "ProductState" NOT NULL DEFAULT 'FRESH',
    "initialQuantityKg" DECIMAL(65,30) NOT NULL,
    "quantityKg" DECIMAL(65,30) NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "coldStorageId" TEXT,
    "status" "ProductLotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessingRun_farmId_idx" ON "ProcessingRun"("farmId");

-- CreateIndex
CREATE INDEX "ProcessingRun_sourceBatchId_idx" ON "ProcessingRun"("sourceBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLot_qrCode_key" ON "ProductLot"("qrCode");

-- CreateIndex
CREATE INDEX "ProductLot_farmId_idx" ON "ProductLot"("farmId");

-- CreateIndex
CREATE INDEX "ProductLot_sourceBatchId_idx" ON "ProductLot"("sourceBatchId");

-- CreateIndex
CREATE INDEX "ProductLot_coldStorageId_idx" ON "ProductLot"("coldStorageId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLot_farmId_lotCode_key" ON "ProductLot"("farmId", "lotCode");

-- AddForeignKey
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingRun" ADD CONSTRAINT "ProcessingRun_sourceAnimalId_fkey" FOREIGN KEY ("sourceAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLot" ADD CONSTRAINT "ProductLot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLot" ADD CONSTRAINT "ProductLot_processingRunId_fkey" FOREIGN KEY ("processingRunId") REFERENCES "ProcessingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLot" ADD CONSTRAINT "ProductLot_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLot" ADD CONSTRAINT "ProductLot_coldStorageId_fkey" FOREIGN KEY ("coldStorageId") REFERENCES "ColdStorage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
