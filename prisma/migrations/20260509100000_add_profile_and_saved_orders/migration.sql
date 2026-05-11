-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  Profile + SavedOrderTemplate                                       ║
-- ║  - User дээр companyName, address багана нэмнэ                      ║
-- ║  - SavedOrderTemplate шинэ хүснэгт үүсгэнэ                          ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- 1) User дээр шинэ багана
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address"     TEXT;

-- 2) SavedOrderTemplate хүснэгт
CREATE TABLE IF NOT EXISTS "SavedOrderTemplate" (
    "id"            SERIAL PRIMARY KEY,
    "userId"        INTEGER NOT NULL,
    "label"         TEXT NOT NULL,
    "serviceTypeId" INTEGER,
    "zoneId"        INTEGER,
    "address"       TEXT NOT NULL,
    "volume"        DOUBLE PRECISION NOT NULL,
    "volumeUnit"    TEXT NOT NULL DEFAULT 'TON',
    "pitStatus"     TEXT,
    "pitType"       TEXT,
    "notes"         TEXT,
    "lat"           DOUBLE PRECISION,
    "lng"           DOUBLE PRECISION,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) FK
ALTER TABLE "SavedOrderTemplate"
    ADD CONSTRAINT "SavedOrderTemplate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Index
CREATE INDEX IF NOT EXISTS "SavedOrderTemplate_userId_idx" ON "SavedOrderTemplate"("userId");
