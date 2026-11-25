-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cartVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "useCases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CartItem" (
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'COD',
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "subtotal" DECIMAL(20,0) NOT NULL,
    "shippingFee" DECIMAL(20,0) NOT NULL,
    "total" DECIMAL(20,0) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,0) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(20,0) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 999);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 999);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_amounts_valid" CHECK ("unitPrice" >= 0 AND "lineTotal" = "unitPrice" * "quantity");
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_valid" CHECK ("subtotal" >= 0 AND "shippingFee" >= 0 AND "total" = "subtotal" + "shippingFee");
ALTER TABLE "Product" ADD CONSTRAINT "Product_version_nonnegative" CHECK ("version" >= 0);

-- Backfill only the original demo SKUs; user-created products and stock are untouched.
UPDATE "Product" SET "useCases" = ARRAY['study','office']::TEXT[] WHERE "sku" IN ('DEMO-LAP-01','DEMO-KEY-01') AND cardinality("useCases") = 0;
UPDATE "Product" SET "useCases" = ARRAY['creative','gaming']::TEXT[] WHERE "sku" IN ('DEMO-LAP-02','DEMO-GPU-01') AND cardinality("useCases") = 0;
UPDATE "Product" SET "useCases" = ARRAY['office','creative']::TEXT[] WHERE "sku" IN ('DEMO-PC-01','DEMO-MON-01') AND cardinality("useCases") = 0;
