-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MORTALITY', 'CULL');

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "batchId" TEXT,
    "fromUnitId" TEXT,
    "toUnitId" TEXT,
    "count" INTEGER,
    "reason" TEXT,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortalityEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "batchId" TEXT,
    "type" "EventType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "cause" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MortalityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Movement_farmId_idx" ON "Movement"("farmId");

-- CreateIndex
CREATE INDEX "Movement_animalId_idx" ON "Movement"("animalId");

-- CreateIndex
CREATE INDEX "Movement_batchId_idx" ON "Movement"("batchId");

-- CreateIndex
CREATE INDEX "MortalityEvent_farmId_idx" ON "MortalityEvent"("farmId");

-- CreateIndex
CREATE INDEX "MortalityEvent_batchId_idx" ON "MortalityEvent"("batchId");

-- CreateIndex
CREATE INDEX "MortalityEvent_animalId_idx" ON "MortalityEvent"("animalId");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityEvent" ADD CONSTRAINT "MortalityEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityEvent" ADD CONSTRAINT "MortalityEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortalityEvent" ADD CONSTRAINT "MortalityEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
