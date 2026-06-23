-- CreateEnum
CREATE TYPE "HatchStatus" AS ENUM ('SET', 'INCUBATING', 'CANDLED', 'LOCKDOWN', 'HATCHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncubationEventType" AS ENUM ('CANDLING', 'LOCKDOWN', 'HATCH', 'TEMP_LOG', 'TURN', 'OTHER');

-- CreateTable
CREATE TABLE "HatcheryBatch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "code" TEXT NOT NULL,
    "setDate" TIMESTAMP(3) NOT NULL,
    "eggCount" INTEGER NOT NULL,
    "incubationDays" INTEGER NOT NULL,
    "expectedHatchDate" TIMESTAMP(3) NOT NULL,
    "candlingDate" TIMESTAMP(3),
    "lockdownDate" TIMESTAMP(3),
    "status" "HatchStatus" NOT NULL DEFAULT 'SET',
    "fertileCount" INTEGER,
    "hatchedCount" INTEGER,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HatcheryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubationLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "hatcheryBatchId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" "IncubationEventType" NOT NULL,
    "temperatureC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncubationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HatcheryBatch_farmId_idx" ON "HatcheryBatch"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "HatcheryBatch_farmId_code_key" ON "HatcheryBatch"("farmId", "code");

-- CreateIndex
CREATE INDEX "IncubationLog_hatcheryBatchId_idx" ON "IncubationLog"("hatcheryBatchId");

-- AddForeignKey
ALTER TABLE "HatcheryBatch" ADD CONSTRAINT "HatcheryBatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HatcheryBatch" ADD CONSTRAINT "HatcheryBatch_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HatcheryBatch" ADD CONSTRAINT "HatcheryBatch_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubationLog" ADD CONSTRAINT "IncubationLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubationLog" ADD CONSTRAINT "IncubationLog_hatcheryBatchId_fkey" FOREIGN KEY ("hatcheryBatchId") REFERENCES "HatcheryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
