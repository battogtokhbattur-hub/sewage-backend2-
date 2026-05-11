/*
  Warnings:

  - You are about to drop the column `lat` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `priceSubtotal` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `priceTotal` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `slotId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `volumeUnit` on the `Order` table. All the data in the column will be lost.
  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `date` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceType` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timeSlot` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_slotId_fkey";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Order_userId_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "priceSubtotal",
DROP COLUMN "priceTotal",
DROP COLUMN "slotId",
DROP COLUMN "volumeUnit",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "district" TEXT NOT NULL DEFAULT 'BZD',
ADD COLUMN     "extras" TEXT[],
ADD COLUMN     "serviceType" TEXT NOT NULL,
ADD COLUMN     "timeSlot" TEXT NOT NULL,
ADD COLUMN     "timeSlotId" INTEGER,
ADD COLUMN     "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'ton',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "volume" SET DEFAULT 5,
ALTER COLUMN "volume" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "VolumeUnit";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
