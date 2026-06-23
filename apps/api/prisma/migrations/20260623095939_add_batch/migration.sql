-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "unitId" TEXT,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "currentStageId" TEXT,
    "initialCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquiredAt" TIMESTAMP(3),
    "source" TEXT,
    "qrCode" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Batch_qrCode_key" ON "Batch"("qrCode");

-- CreateIndex
CREATE INDEX "Batch_farmId_idx" ON "Batch"("farmId");

-- CreateIndex
CREATE INDEX "Batch_speciesId_idx" ON "Batch"("speciesId");

-- CreateIndex
CREATE INDEX "Batch_unitId_idx" ON "Batch"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_farmId_code_key" ON "Batch"("farmId", "code");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "LifecycleStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
