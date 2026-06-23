-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('FEED', 'EGGS', 'WEIGHT');

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "LogType" NOT NULL,
    "batchId" TEXT,
    "animalId" TEXT,
    "unitId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "clientLogId" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_clientLogId_key" ON "DailyLog"("clientLogId");

-- CreateIndex
CREATE INDEX "DailyLog_farmId_idx" ON "DailyLog"("farmId");

-- CreateIndex
CREATE INDEX "DailyLog_type_idx" ON "DailyLog"("type");

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
