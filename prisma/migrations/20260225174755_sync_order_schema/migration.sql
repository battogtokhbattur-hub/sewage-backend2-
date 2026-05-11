/*
  Warnings:

  - You are about to drop the column `date` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `district` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `extras` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `serviceType` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `timeSlot` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `timeSlotId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalPrice` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `Order` table. All the data in the column will be lost.
  - Added the required column `slotId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Made the column `serviceTypeId` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Made the column `zoneId` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_serviceTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_timeSlotId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_zoneId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "date",
DROP COLUMN "district",
DROP COLUMN "extras",
DROP COLUMN "serviceType",
DROP COLUMN "timeSlot",
DROP COLUMN "timeSlotId",
DROP COLUMN "totalPrice",
DROP COLUMN "unit",
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "priceSubtotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slotId" INTEGER NOT NULL,
ADD COLUMN     "volumeUnit" TEXT NOT NULL DEFAULT 'TON',
ALTER COLUMN "volume" SET DEFAULT 0,
ALTER COLUMN "serviceTypeId" SET NOT NULL,
ALTER COLUMN "zoneId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
