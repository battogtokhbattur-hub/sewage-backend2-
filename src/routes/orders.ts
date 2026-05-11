import { Router } from "express";
import prisma from "../prisma";
import { auth } from "../middleware/auth";
import { sendInvoiceEmail, sendAdminOrderNotification } from "../services/emailService";

const router = Router();

/* ──────────────────────────────────────────────
   ⚠️ ВАЖНО: Үнэ тооцох формула frontend-тэй ИЖИЛ байх ёстой!
   Frontend: lib/orderTypes.ts
     BASE_PRICE        = 100_000
     VOLUME_UNIT_PRICE =   5_000
     EXTRAS: urgent=20000, offhours=15000, multi=10000
   Хуучин код zone.basePrice + zone.perTonPrice ашигладаг байсан нь
   email дээр өөр үнэ харагдах гол шалтгаан байсан.
────────────────────────────────────────────── */
const BASE_PRICE        = 100_000;
const VOLUME_UNIT_PRICE =   5_000;

// EXTRA_ID_MAP: id -> price (frontend EXTRAS-тэй ижил)
const EXTRA_PRICES: Record<number, { name: string; price: number }> = {
  1: { name: "⚡ Яаралтай",             price: 20_000 },
  2: { name: "🌙 Шөнө / Амралтын өдөр", price: 15_000 },
  3: { name: "🗺️ Олон цэг",              price: 10_000 },
};

// Driver-той бүрэн include
const ORDER_INCLUDE_FULL = {
  serviceType: true,
  zone:        true,
  slot:        true,
  addOns:      { include: { addOn: true } },
  driver:      {
    select: {
      id: true, name: true, phone: true,
      truckName: true, truckPlate: true, truckCapacity: true,
    },
  },
} as const;

// Driver-гүй (хэрэв Driver model байхгүй prisma client дээр)
const ORDER_INCLUDE_BASIC = {
  serviceType: true,
  zone:        true,
  slot:        true,
  addOns:      { include: { addOn: true } },
} as const;

const ORDER_INCLUDE = ORDER_INCLUDE_FULL;

async function countOrdersForDateSlot(tx: any, slotId: number, date: string): Promise<number> {
  const dayStart = new Date(date + "T00:00:00.000Z");
  const dayEnd   = new Date(date + "T23:59:59.999Z");
  return tx.order.count({
    where: { slotId, createdAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["CANCELED"] } },
  });
}

router.get("/slots", async (req: any, res) => {
  const { date } = req.query as { date?: string };
  if (!date) return res.status(400).json({ message: "date шаардлагатай" });
  try {
    const slots = await prisma.timeSlot.findMany({
      orderBy: { startTime: "asc" },
      select: { id: true, startTime: true, endTime: true, capacity: true },
    });
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd   = new Date(date + "T23:59:59.999Z");
    const counts = await Promise.all(slots.map((s: any) => prisma.order.count({
      where: { slotId: s.id, createdAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["CANCELED"] } },
    })));
    return res.json(slots.map((s: any, i: number) => ({
      id:        `${String(s.startTime).slice(0,2)}-${String(s.endTime).slice(0,2)}`,
      label:     `${String(s.startTime).slice(0,2)}:00 – ${String(s.endTime).slice(0,2)}:00`,
      dbId:      s.id,
      available: counts[i] < s.capacity,
      remaining: Math.max(0, s.capacity - counts[i]),
    })));
  } catch (e) {
    return res.status(500).json({ message: "Slot мэдээлэл татахад алдаа гарлаа" });
  }
});

router.post("/", auth, async (req: any, res) => {
  const {
    serviceTypeId, zoneId, address, volume, volumeUnit, slotId, date,
    addOnIds = [], lat, lng,
    customerName, customerPhone, notes,
    // Frontend-ээс илгээдэг нэмэлт талбарууд
    pitStatus, pitType, district, unit, timeSlot, extras = [],
    serviceType: serviceTypeLabel,
    // ⚠️ AЮУЛГҮЙ БАЙДЛЫН АНХААРУУЛГА:
    // Frontend-ийн илгээсэн totalPrice, basePrice-ийг ХҮЛЭЭН АВАХГҮЙ.
    // Хэрэглэгч browser-аас үнээ өөрчилж илгээж болзошгүй учир
    // server тал даа ҮРГЭЛЖ дахин тооцох ёстой.
  } = req.body;

  if (!serviceTypeId || !zoneId || !address || !volume || !slotId)
    return res.status(400).json({ message: "Заавал бөглөх талбарууд дутуу байна" });

  // ── Хэрэглэгч DB-д бүртгэлтэй эсэхийг шалгах ──
  // (migrate reset эсвэл DB цэвэрлэгдсэн бол өмнөх token-той хэрэглэгч байхгүй болсон)
  if (!req.user?.id) {
    return res.status(401).json({ message: "Нэвтрэлтийн алдаа: дахин нэвтэрнэ үү" });
  }
  const userExists = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!userExists) {
    return res.status(401).json({
      message: "Таны нэвтрэлт хүчингүй болсон. Logout хийгээд дахин нэвтэрнэ үү.",
    });
  }

  // Latin "TON" эсвэл Cyrillic "TOН" аль алийг хүлээн авна
  const normalizedUnit: "TON" | "M3" =
    String(volumeUnit ?? "TON").toUpperCase().includes("M3") ? "M3" : "TON";

  try {
    const created = await prisma.$transaction(async (tx: any) => {
      const slot = await tx.timeSlot.findUnique({ where: { id: Number(slotId) } });
      if (!slot) throw new Error("SLOT_NOT_FOUND");
      if (await countOrdersForDateSlot(tx, slot.id, date) >= slot.capacity)
        throw new Error("SLOT_FULL");

      const zone = await tx.zone.findUnique({ where: { id: Number(zoneId) } });
      if (!zone) throw new Error("ZONE_NOT_FOUND");

      /* ── ҮНЭ ТООЦОО (frontend-тэй ижил формула) ──
         🔒 АЮУЛГҮЙ БАЙДЛЫН ҮҮДНЭЭС: server-side л үнэ тооцоолно.
         Frontend-ийн илгээсэн үнийг ХЭЗЭЭ Ч ИТГЭХГҮЙ. */
      const subtotal = BASE_PRICE + Math.round(Number(volume) * VOLUME_UNIT_PRICE);

      // AddOn нэмэлт үйлчилгээний нийлбэрийг тооцох
      const addOnIdNums = (addOnIds || []).map(Number).filter((n: number) => !isNaN(n));
      const dbAddOns = await tx.addOnService.findMany({
        where: { id: { in: addOnIdNums }, isActive: true },
      });
      const dbAddOnMap = new Map<number, any>(dbAddOns.map((a: any) => [a.id, a]));

      let addOnTotal = 0;
      for (const id of addOnIdNums) {
        const dbA = dbAddOnMap.get(id);
        if (dbA) {
          addOnTotal += dbA.priceType === "FIXED"
            ? dbA.priceValue
            : Math.round((subtotal * dbA.priceValue) / 100);
        } else if (EXTRA_PRICES[id]) {
          addOnTotal += EXTRA_PRICES[id].price;
        }
      }

      // Server дээр л тооцоолсон эцсийн үнэ — frontend ашигладаггүй
      const finalBase  = subtotal;
      const finalTotal = subtotal + addOnTotal;

      return await tx.order.create({
        data: {
          userId:        req.user.id,
          address:       String(address),
          volume:        Number(volume),
          volumeUnit:    normalizedUnit,
          serviceTypeId: Number(serviceTypeId),
          zoneId:        Number(zoneId),
          slotId:        Number(slotId),
          lat:           lat ?? null,
          lng:           lng ?? null,
          status:        "PENDING",
          priceSubtotal: finalBase,
          priceTotal:    finalTotal,
          totalPrice:    finalTotal,
          customerName:  customerName?.trim()  || null,
          customerPhone: customerPhone?.trim() || null,
          notes:         notes?.trim()         || null,
          // Нэмэлт талбарууд (DB дээр байгаа бол хадгална)
          pitStatus:     pitStatus ?? null,
          pitType:       pitType   ?? null,
          date:          date      ?? null,
          district:      district  ?? "БЗД",
          unit:          unit      ?? "тонн",
          timeSlot:      timeSlot  ?? "",
          extras:        Array.isArray(extras) ? extras : [],
          addOns: {
            create: addOnIdNums
              .filter((id: number) => dbAddOnMap.has(id))   // зөвхөн DB-д байгааг л хадгална
              .map((id: number) => ({ addOnId: id })),
          },
        },
        include: { ...ORDER_INCLUDE, user: true },
      } as any);
    });

    const o = created as any;

    /* ── Admin email (fire-and-forget) ── */
    setImmediate(async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) return;

        // AddOn email жагсаалтыг бэлдэх
        const addOnEmailList: { name: string; price: number }[] = [];
        for (const oa of (o.addOns ?? [])) {
          const dbA = oa.addOn;
          const price = dbA.priceType === "FIXED"
            ? dbA.priceValue
            : Math.round(((o.priceSubtotal ?? 0) * dbA.priceValue) / 100);
          addOnEmailList.push({ name: dbA.name, price });
        }
        // DB-д байхгүй extras (хатуу-кодолсон) нэмнэ
        for (const id of (addOnIds || []).map(Number)) {
          if (!isNaN(id) && EXTRA_PRICES[id] && !addOnEmailList.some(a => a.name === EXTRA_PRICES[id].name)) {
            addOnEmailList.push(EXTRA_PRICES[id]);
          }
        }

        const slotLabel = o.slot
          ? `${String(o.slot.startTime).slice(0,5)} – ${String(o.slot.endTime).slice(0,5)}`
          : (timeSlot ?? "—");

        await sendAdminOrderNotification({
          adminEmail,
          orderId:       o.id,
          customerEmail: o.user?.email  ?? "—",
          customerName:  o.customerName  || o.user?.name  || "—",
          customerPhone: o.customerPhone || o.user?.phone || "—",
          address:       o.address,
          serviceType:   serviceTypeLabel || o.serviceType?.name || "—",
          zone:          o.zone?.name || district || "—",
          volume:        o.volume,
          volumeUnit:    o.volumeUnit,
          date:          String(o.date ?? date ?? ""),
          slot:          slotLabel,
          notes:         o.notes ?? "",
          pitStatus:     pitStatus ?? o.pitStatus ?? undefined,
          pitType:       pitType   ?? o.pitType   ?? undefined,
          addOns:        addOnEmailList,
          priceSubtotal: o.priceSubtotal,
          priceTotal:    o.priceTotal,
          createdAt:     new Date(o.createdAt).toLocaleDateString("mn-MN", {
            year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          }),
          dashboardUrl:  `${process.env.ADMIN_DASHBOARD_URL ?? "http://localhost:3000"}/dashboard/orders/${o.id}`,
        });
        console.log(`[NewOrder] Admin email → ${adminEmail} (Order #${o.id}, total: ${o.priceTotal}₮)`);
      } catch (err) {
        console.error(`[NewOrder] Admin email failed #${o.id}:`, err);
      }
    });

    return res.status(201).json(created);
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "SLOT_FULL")      return res.status(409).json({ message: "Сонгосон цаг дүүрсэн байна." });
    if (msg === "SLOT_NOT_FOUND") return res.status(404).json({ message: "Цагийн slot олдсонгүй" });
    if (msg === "ZONE_NOT_FOUND") return res.status(404).json({ message: "Бүс олдсонгүй" });
    console.error("createOrder error:", e);
    return res.status(500).json({ message: "Захиалга үүсгэхэд алдаа гарлаа" });
  }
});

/* orders/all (ADMIN) */
router.get("/all", auth, async (req: any, res) => {
  if (String(req.user?.role ?? "").toUpperCase() !== "ADMIN")
    return res.status(403).json({ message: "Зөвхөн админ" });
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { ...ORDER_INCLUDE, user: true },
    });
    return res.json(orders);
  } catch (e) {
    return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
  }
});

/* orders/my */
router.get("/my", auth, async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User ID олдсонгүй" });
    }

    let orders;
    try {
      // Эхлээд driver-тэй full include-аар оролдоно
      orders = await prisma.order.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE_FULL,
      });
    } catch (e1: any) {
      // Driver model байхгүй бол basic-аар буцна
      console.warn("[orders/my] Full include failed, trying basic:", e1.message);
      orders = await prisma.order.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE_BASIC,
      });
    }

    return res.json(orders);
  } catch (e: any) {
    console.error("[orders/my] ERROR:", e?.message || e);
    console.error("[orders/my] Stack:", e?.stack);
    return res.status(500).json({
      message: "Захиалга татахад алдаа гарлаа",
      detail: process.env.NODE_ENV !== "production" ? e?.message : undefined,
    });
  }
});

router.get("/", auth, async (req: any, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "User ID олдсонгүй" });
    }

    let orders;
    try {
      orders = await prisma.order.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE_FULL,
      });
    } catch (e1: any) {
      console.warn("[orders/] Full include failed, trying basic:", e1.message);
      orders = await prisma.order.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE_BASIC,
      });
    }

    return res.json(orders);
  } catch (e: any) {
    console.error("[orders/] ERROR:", e?.message || e);
    console.error("[orders/] Stack:", e?.stack);
    return res.status(500).json({
      message: "Захиалга татахад алдаа гарлаа",
      detail: process.env.NODE_ENV !== "production" ? e?.message : undefined,
    });
  }
});

/* /orders/:id */
router.get("/:id", auth, async (req: any, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });
  try {
    const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (order.userId !== req.user.id && req.user.role !== "ADMIN")
      return res.status(403).json({ message: "Эрх байхгүй" });
    return res.json(order);
  } catch (e) {
    return res.status(500).json({ message: "Алдаа гарлаа" });
  }
});

/* orders/:id/cancel */
router.put("/:id/cancel", auth, async (req: any, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });
  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing)                         return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.userId !== req.user.id)   return res.status(403).json({ message: "Эрх байхгүй" });
    if (existing.status === "DONE")        return res.status(400).json({ message: "Дууссан захиалгыг цуцлах боломжгүй" });
    if (existing.status === "CANCELED")    return res.status(400).json({ message: "Аль хэдийн цуцлагдсан" });
    if (existing.status === "IN_PROGRESS") return res.status(400).json({ message: "Явагдаж буй захиалгыг цуцлах боломжгүй" });
    await prisma.order.update({ where: { id }, data: { status: "CANCELED" } });
    return res.json({ message: "Захиалга амжилттай цуцлагдлаа" });
  } catch (e) {
    return res.status(500).json({ message: "Цуцлахад алдаа гарлаа" });
  }
});

/* /orders/:id/status (ADMIN) */
router.patch("/:id/status", auth, async (req: any, res) => {
  if (String(req.user?.role ?? "").toUpperCase() !== "ADMIN")
    return res.status(403).json({ message: "Зөвхөн админ" });
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });
  if (!["PENDING","CONFIRMED","IN_PROGRESS","DONE","CANCELED"].includes(status))
    return res.status(400).json({ message: "Буруу статус" });

  try {
    const order = await prisma.order.update({
      where: { id }, data: { status },
      include: { ...ORDER_INCLUDE, user: true },
    }) as any;

    if (status === "DONE" && order.user?.email) {
      setImmediate(async () => {
        try {
          await sendInvoiceEmail({
            orderId:       order.id,
            customerEmail: order.user.email,
            address:       order.address,
            serviceType:   order.serviceType?.name ?? "—",
            zone:          order.zone?.name ?? "—",
            volume:        order.volume,
            volumeUnit:    order.volumeUnit,
            slot:          order.slot
              ? `${String(order.slot.startTime).slice(0,5)} – ${String(order.slot.endTime).slice(0,5)}`
              : "—",
            priceSubtotal: order.priceSubtotal,
            addOns: (order.addOns ?? []).map((a: any) => ({
              name:  a.addOn.name,
              price: a.addOn.priceValue,
            })),
            priceTotal:  order.priceTotal,
            createdAt:   new Date(order.createdAt).toLocaleDateString("mn-MN", {
              year: "numeric", month: "long", day: "numeric",
            }),
            completedAt: new Date().toLocaleDateString("mn-MN", {
              year: "numeric", month: "long", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            }),
          });
        } catch (err) {
          console.error(`[Invoice] Failed #${order.id}:`, err);
        }
      });
    }

    return res.json(order);
  } catch (e) {
    console.error("updateStatus error:", e);
    return res.status(500).json({ message: "Статус шинэчлэхэд алдаа гарлаа" });
  }
});

export default router;
