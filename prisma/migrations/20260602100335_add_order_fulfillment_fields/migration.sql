-- AlterTable
ALTER TABLE "ShopifyOrderCache" ADD COLUMN     "fulfillmentStatus" TEXT,
ADD COLUMN     "shipmentStatus" TEXT,
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateIndex
CREATE INDEX "ShopifyOrderCache_orderNumber_idx" ON "ShopifyOrderCache"("orderNumber");
