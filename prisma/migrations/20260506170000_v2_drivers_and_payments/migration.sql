-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  V2 Migration: Driver хүснэгт + Order дээр төлбөр/жолоочийн талбар  ║
-- ║                                                                      ║
-- ║  Идэмхий migration — олон удаа эсвэл аль ч өгөгдлийн нөхцөлд         ║
-- ║  ажиллана:                                                           ║
-- ║    • Шинэ DB                                                         ║
-- ║    • Хуучин DRIVER role-той DB                                       ║
-- ║    • Зөвхөн зарим багана нь нэмэгдсэн DB                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────────────
-- 1) Driver хүснэгт үүсгэх (хэрэв байхгүй бол)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Driver" (
    "id"            SERIAL PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "phone"         TEXT NOT NULL,
    "truckName"     TEXT,
    "truckPlate"    TEXT,
    "truckCapacity" DOUBLE PRECISION DEFAULT 0,
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────
-- 2) Order дээрх шинэ багануудыг нэмэх (байхгүй бол)
-- ────────────────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "driverId"      INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignedAt"    TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paid"          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt"        TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;

-- ────────────────────────────────────────────────
-- 3) Хуучин FK-ыг устгах (User эсвэл Driver руу заасан байж магадгүй)
-- ────────────────────────────────────────────────
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_driverId_fkey";

-- ────────────────────────────────────────────────
-- 4) Хэрэв хуучин driverId User.id руу заасан бол null болгох
--    (учир нь шинэ schema-д Driver хүснэгт руу заана)
-- ────────────────────────────────────────────────
DO $$
BEGIN
    -- User хүснэгт байгаа эсэхийг шалгах ба driverId null биш бичлэг байгаа эсэхийг
    IF EXISTS (
        SELECT 1 FROM "Order" o
        WHERE o."driverId" IS NOT NULL
          AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = o."driverId")
          AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d."id" = o."driverId")
    ) THEN
        UPDATE "Order" SET "driverId" = NULL WHERE "driverId" IS NOT NULL;
    END IF;
END $$;

-- ────────────────────────────────────────────────
-- 5) DRIVER role-той хэрэглэгчийг USER рольд буцаах
--    (DRIVER enum утга байгаа тохиолдолд л)
-- ────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'Role' AND e.enumlabel = 'DRIVER'
    ) THEN
        UPDATE "User" SET "role" = 'USER' WHERE "role"::text = 'DRIVER';
    END IF;
END $$;

-- ────────────────────────────────────────────────
-- 6) Role enum-аас DRIVER-ийг хасах
--    (PostgreSQL дээр enum-аас утга устгах нь enum-ийг RECREATE хийх замаар)
-- ────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'Role' AND e.enumlabel = 'DRIVER'
    ) THEN
        ALTER TYPE "Role" RENAME TO "Role_old_v2";
        CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

        ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
        ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
        ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

        DROP TYPE "Role_old_v2";
    END IF;
END $$;

-- ────────────────────────────────────────────────
-- 7) Шинэ FK: Order.driverId → Driver.id
-- ────────────────────────────────────────────────
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────
-- 8) Хайлтыг хурдасгах indexүүд
-- ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Order_driverId_idx"  ON "Order"("driverId");
CREATE INDEX IF NOT EXISTS "Order_status_idx"    ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Driver_isActive_idx" ON "Driver"("isActive");
