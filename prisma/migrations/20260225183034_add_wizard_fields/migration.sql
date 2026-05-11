-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_serviceTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_slotId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_zoneId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "district" TEXT NOT NULL DEFAULT 'БЗД',
ADD COLUMN     "extras" TEXT[],
ADD COLUMN     "serviceCode" TEXT NOT NULL DEFAULT 'BOHIR_US',
ADD COLUMN     "timeSlot" TEXT NOT NULL DEFAULT '09-11',
ADD COLUMN     "totalPrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'тонн',
ALTER COLUMN "serviceTypeId" DROP NOT NULL,
ALTER COLUMN "zoneId" DROP NOT NULL,
ALTER COLUMN "slotId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
