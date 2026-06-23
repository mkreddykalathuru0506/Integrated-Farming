-- CreateEnum
CREATE TYPE "ProductState" AS ENUM ('FRESH', 'FROZEN');

-- CreateTable
CREATE TABLE "ColdStorage" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitId" TEXT,
    "mode" "ProductState" NOT NULL DEFAULT 'FROZEN',
    "minTempC" DOUBLE PRECISION NOT NULL DEFAULT -30,
    "maxTempC" DOUBLE PRECISION NOT NULL DEFAULT -18,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ColdStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemperatureLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "coldStorageId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "isOutOfRange" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ColdStorage_farmId_idx" ON "ColdStorage"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "ColdStorage_farmId_name_key" ON "ColdStorage"("farmId", "name");

-- CreateIndex
CREATE INDEX "TemperatureLog_farmId_idx" ON "TemperatureLog"("farmId");

-- CreateIndex
CREATE INDEX "TemperatureLog_coldStorageId_idx" ON "TemperatureLog"("coldStorageId");

-- CreateIndex
CREATE INDEX "TemperatureLog_recordedAt_idx" ON "TemperatureLog"("recordedAt");

-- AddForeignKey
ALTER TABLE "ColdStorage" ADD CONSTRAINT "ColdStorage_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_coldStorageId_fkey" FOREIGN KEY ("coldStorageId") REFERENCES "ColdStorage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
