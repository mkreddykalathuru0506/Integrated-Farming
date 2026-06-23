-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refrigeratedTransport" BOOLEAN NOT NULL DEFAULT false,
    "vehicleNumber" TEXT,
    "dispatchTempC" DOUBLE PRECISION,
    "coldChainOk" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchLine" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "productLotId" TEXT,
    "batchId" TEXT,
    "qtyKg" DECIMAL(65,30),
    "count" INTEGER,

    CONSTRAINT "DispatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dispatch_farmId_idx" ON "Dispatch"("farmId");

-- CreateIndex
CREATE INDEX "Dispatch_salesOrderId_idx" ON "Dispatch"("salesOrderId");

-- CreateIndex
CREATE INDEX "DispatchLine_dispatchId_idx" ON "DispatchLine"("dispatchId");

-- CreateIndex
CREATE INDEX "DispatchLine_productLotId_idx" ON "DispatchLine"("productLotId");

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLine" ADD CONSTRAINT "DispatchLine_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLine" ADD CONSTRAINT "DispatchLine_productLotId_fkey" FOREIGN KEY ("productLotId") REFERENCES "ProductLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
