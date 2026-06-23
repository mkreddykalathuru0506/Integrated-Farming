-- CreateEnum
CREATE TYPE "FeedTxnType" AS ENUM ('PURCHASE', 'CONSUMPTION');

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "stockQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reorderThreshold" DECIMAL(65,30),
    "lastUnitPricePaise" BIGINT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedTransaction" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "feedItemId" TEXT NOT NULL,
    "type" "FeedTxnType" NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "unitPricePaise" BIGINT,
    "totalPaise" BIGINT,
    "batchId" TEXT,
    "vendorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedItem_farmId_idx" ON "FeedItem"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_farmId_name_key" ON "FeedItem"("farmId", "name");

-- CreateIndex
CREATE INDEX "FeedTransaction_farmId_idx" ON "FeedTransaction"("farmId");

-- CreateIndex
CREATE INDEX "FeedTransaction_feedItemId_idx" ON "FeedTransaction"("feedItemId");

-- CreateIndex
CREATE INDEX "FeedTransaction_batchId_idx" ON "FeedTransaction"("batchId");

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTransaction" ADD CONSTRAINT "FeedTransaction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedTransaction" ADD CONSTRAINT "FeedTransaction_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
