// src/seed.ts — Lookup data (Service types, Zones, AddOns, TimeSlots)
// Ажиллуулах: npm run seed:lookups
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Lookup data суулгаж байна...\n");

  /* ────────────────────────────────────────────
     1) Service Types (Үйлчилгээний төрлүүд)
  ──────────────────────────────────────────── */
  const serviceTypes = [
    { code: "BOHIR_US", name: "Бохир ус тээвэр" },
    { code: "LAG",      name: "Лаг соруулах" },
    { code: "SEPTIK",   name: "Септик соруулах" },
    { code: "UGALGA",   name: "Угаалга" },
  ];

  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({
      where:  { code: st.code },
      update: { name: st.name, isActive: true },
      create: st,
    });
  }
  console.log(`✅ ${serviceTypes.length} үйлчилгээний төрөл`);

  /* ────────────────────────────────────────────
     2) Zones (Дүүрэг)
  ──────────────────────────────────────────── */
  const zones = [
    { name: "БЗД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "СБД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "ХУД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "ЧД",   basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "СХД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "БГД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "НД",   basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "БНД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
    { name: "БХД",  basePrice: 100000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
  ];

  for (const z of zones) {
    await prisma.zone.upsert({
      where:  { name: z.name },
      update: z,
      create: z,
    });
  }
  console.log(`✅ ${zones.length} дүүрэг`);

  /* ────────────────────────────────────────────
     3) Add-On Services (Нэмэлт үйлчилгээ)
     ⚠️ ID болон үнэ нь frontend lib/orderTypes.ts-тэй ИЖИЛ байх ёстой
  ──────────────────────────────────────────── */
  const addOns = [
    { code: "URGENT",      name: "⚡ Яаралтай",            priceType: "FIXED" as const, priceValue: 20000 },
    { code: "OFFHOURS",    name: "🌙 Шөнө / Амралтын өдөр", priceType: "FIXED" as const, priceValue: 15000 },
    { code: "MULTI_POINT", name: "🗺️ Олон цэг",             priceType: "FIXED" as const, priceValue: 10000 },
  ];

  for (const a of addOns) {
    await prisma.addOnService.upsert({
      where:  { code: a.code },
      update: { ...a, isActive: true },
      create: a,
    });
  }
  console.log(`✅ ${addOns.length} нэмэлт үйлчилгээ`);

  /* ────────────────────────────────────────────
     4) Time Slots — ӨНӨӨДРӨӨС 90 ӨДРИЙН ЦАГИЙН ЦОНХ
     Хэрэглэгч ирэх 3 сарын дотор ямар ч өдөр сонгож болно
  ──────────────────────────────────────────── */
  const slots = [
    { startTime: "09:00", endTime: "11:00" },
    { startTime: "11:00", endTime: "13:00" },
    { startTime: "14:00", endTime: "16:00" },
    { startTime: "16:00", endTime: "18:00" },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let slotCount = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    for (const s of slots) {
      await prisma.timeSlot.upsert({
        where: {
          date_startTime_endTime: {
            date:      d,
            startTime: s.startTime,
            endTime:   s.endTime,
          },
        },
        update: { capacity: 3 },
        create: {
          date:        d,
          startTime:   s.startTime,
          endTime:     s.endTime,
          capacity:    3,
          bookedCount: 0,
        },
      });
      slotCount++;
    }
  }
  console.log(`✅ ${slotCount} цагийн цонх (ирэх 90 өдөр)`);

  console.log("\n🎉 Бүх lookup data амжилттай суулаа!");
}

main()
  .catch((e) => {
    console.error("❌ Алдаа:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
