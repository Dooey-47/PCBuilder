-- Additive upgrade: preserve order IDs, item/address/price snapshots and stock.
ALTER TYPE "PaymentMethod" ADD VALUE 'SIMULATED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
ALTER TABLE "Order" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Order" SET "updatedAt" = "createdAt";
ALTER TABLE "Order" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_version_nonnegative" CHECK ("version" >= 0);
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE TABLE "OrderEvent" (
  "id" SERIAL PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "actorRole" "Role",
  "status" "OrderStatus" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OrderEvent_orderId_id_idx" ON "OrderEvent"("orderId", "id");
-- Existing orders have no reliable transition timestamps. Record an imported snapshot,
-- rather than inventing historical events or changing their current state.
INSERT INTO "OrderEvent" ("orderId", "action", "status", "paymentStatus", "createdAt")
SELECT "id", 'IMPORTED', "status", "paymentStatus", "createdAt" FROM "Order";
