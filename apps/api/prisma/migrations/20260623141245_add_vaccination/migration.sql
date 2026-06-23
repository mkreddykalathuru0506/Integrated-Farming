-- CreateTable
CREATE TABLE "VaccinationScheduleItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "type" "HealthEventType" NOT NULL DEFAULT 'VACCINATION',
    "ageDays" INTEGER NOT NULL,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccinationScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccinationEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "batchId" TEXT,
    "vaccineName" TEXT NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduleItemId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaccinationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaccinationScheduleItem_speciesId_idx" ON "VaccinationScheduleItem"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "VaccinationScheduleItem_farmId_speciesId_vaccineName_ageDay_key" ON "VaccinationScheduleItem"("farmId", "speciesId", "vaccineName", "ageDays");

-- CreateIndex
CREATE INDEX "VaccinationEvent_farmId_idx" ON "VaccinationEvent"("farmId");

-- CreateIndex
CREATE INDEX "VaccinationEvent_batchId_idx" ON "VaccinationEvent"("batchId");

-- AddForeignKey
ALTER TABLE "VaccinationScheduleItem" ADD CONSTRAINT "VaccinationScheduleItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationScheduleItem" ADD CONSTRAINT "VaccinationScheduleItem_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationEvent" ADD CONSTRAINT "VaccinationEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationEvent" ADD CONSTRAINT "VaccinationEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccinationEvent" ADD CONSTRAINT "VaccinationEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
