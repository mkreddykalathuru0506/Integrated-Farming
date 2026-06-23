-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Species" ADD COLUMN     "gestationDays" INTEGER,
ADD COLUMN     "incubationDays" INTEGER;

-- CreateTable
CREATE TABLE "BreedingRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "speciesId" TEXT,
    "damId" TEXT,
    "sireId" TEXT,
    "method" TEXT,
    "breedingDate" TIMESTAMP(3) NOT NULL,
    "expectedDueDate" TIMESTAMP(3),
    "status" "BreedingStatus" NOT NULL DEFAULT 'PLANNED',
    "offspringCount" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreedingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BreedingRecord_farmId_idx" ON "BreedingRecord"("farmId");

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
