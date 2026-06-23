-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'SOLD', 'DEAD', 'CULLED');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "unitId" TEXT,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "tagNumber" TEXT,
    "qrCode" TEXT,
    "name" TEXT,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "dob" TIMESTAMP(3),
    "currentStageId" TEXT,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_qrCode_key" ON "Animal"("qrCode");

-- CreateIndex
CREATE INDEX "Animal_farmId_idx" ON "Animal"("farmId");

-- CreateIndex
CREATE INDEX "Animal_speciesId_idx" ON "Animal"("speciesId");

-- CreateIndex
CREATE INDEX "Animal_unitId_idx" ON "Animal"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_farmId_tagNumber_key" ON "Animal"("farmId", "tagNumber");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "LifecycleStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
