-- CreateTable
CREATE TABLE "MarketRate" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "market" TEXT,
    "pricePaise" BIGINT NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketRate_farmId_commodity_idx" ON "MarketRate"("farmId", "commodity");

-- CreateIndex
CREATE INDEX "MarketRate_fetchedAt_idx" ON "MarketRate"("fetchedAt");

-- AddForeignKey
ALTER TABLE "MarketRate" ADD CONSTRAINT "MarketRate_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
