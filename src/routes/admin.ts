import { Router } from "express";
import prisma from "../prisma";
import { auth, adminOnly } from "../middleware/auth";
import {
  sendOrderConfirmedEmail,
  sendOrderAssignedEmail,
  sendOrderInProgressEmail,
  sendInvoicePaymentEmail,
  sendOrderCompletedEmail,
  sendOrderCanceledEmail,
} from "../services/statusEmails";

const router = Router();

const ORDER_INCLUDE_FULL = {
  user:        { select: { id: true, email: true, name: true, phone: true } },
  driver:      { select: { id: true, name: true, phone: true, truckName: true, truckPlate: true, truckCapacity: true } },
  serviceType: true,
  zone:        true,
  slot:        true,
  addOns:      { include: { addOn: true } },
} as const;

const ORDER_INCLUDE_BASIC = {
  user:        { select: { id: true, email: true, name: true, phone: true } },
  serviceType: true,
  zone:        true,
  slot:        true,
  addOns:      { include: { addOn: true } },
} as const;

const ORDER_INCLUDE = ORDER_INCLUDE_FULL;

function orderToEmailPayload(o: any) {
  const slotLabel = o.slot
    ? `${String(o.slot.startTime).slice(0,5)} – ${String(o.slot.endTime).slice(0,5)}`
    : (o.timeSlot ?? "—");

  return {
    to:           o.user?.email ?? "",
    customerName: o.customerName || o.user?.name || "",
    orderId:      o.id,
    serviceType:  o.serviceType?.name ?? "—",
    district:     o.zone?.name ?? o.district ?? "—",
    address:      o.address,
    volume:       o.volume,
    volumeUnit:   o.volumeUnit ?? "TON",
    date:         o.date ?? "—",
    timeSlot:     slotLabel,
    priceSubtotal: o.priceSubtotal ?? 0,
    addOns:       (o.addOns ?? []).map((oa: any) => ({
      name:  oa.addOn.name,
      price: oa.addOn.priceType === "FIXED"
        ? oa.addOn.priceValue
        : Math.round(((o.priceSubtotal ?? 0) * oa.addOn.priceValue) / 100),
    })),
    totalPrice:   o.priceTotal ?? o.totalPrice ?? 0,
  };
}

/* ════════════════════════════════════════════════════
   GET /admin/orders — Бүх захиалга
═══════════════════════════════════════════════════════ */
router.get("/orders", auth, adminOnly, async (_req, res) => {
  try {
    let orders;
    try {
      orders = await prisma.order.findMany({
        include: ORDER_INCLUDE_FULL,
        orderBy: { id: "desc" },
      });
    } catch (e1: any) {
      console.warn("[admin/orders] Full include failed, trying basic:", e1.message);
      orders = await prisma.order.findMany({
        include: ORDER_INCLUDE_BASIC,
        orderBy: { id: "desc" },
      });
    }
    res.json(orders);
  } catch (err: any) {
    console.error("GET /admin/orders error:", err?.message || err);
    console.error("Stack:", err?.stack);
    res.status(500).json({
      message: "Захиалгууд татахад алдаа гарлаа",
      detail: process.env.NODE_ENV !== "production" ? err?.message : undefined,
    });
  }
});

/* ════════════════════════════════════════════════════
   ЖОЛООЧИЙН УДИРДЛАГА
═══════════════════════════════════════════════════════ */

/* GET /admin/drivers — Жолоочдын жагсаалт */
router.get("/drivers", auth, adminOnly, async (_req, res) => {
  try {
    // Driver model байхгүй бол хоосон массив буцаах
    let drivers: any[] = [];
    try {
      drivers = await prisma.driver.findMany({
        where:   { isActive: true },
        orderBy: { id: "asc" },
      });
    } catch (e: any) {
      console.warn("[admin/drivers] Driver model not available:", e.message);
      return res.json([]);
    }

    // Хувиарлагдсан active захиалгын тоог нэмж буцаах
    const result = await Promise.all(drivers.map(async (d: any) => {
      try {
        const activeOrders = await prisma.order.count({
          where: { driverId: d.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        });
        return { ...d, activeOrders };
      } catch {
        return { ...d, activeOrders: 0 };
      }
    }));

    res.json(result);
  } catch (err: any) {
    console.error("GET /admin/drivers error:", err?.message || err);
    res.status(500).json({
      message: "Жолоочдыг татахад алдаа гарлаа",
      detail: process.env.NODE_ENV !== "production" ? err?.message : undefined,
    });
  }
});

/* POST /admin/drivers — Шинэ жолооч нэмэх (нэр + утас + машин мэдээлэл) */
router.post("/drivers", auth, adminOnly, async (req: any, res) => {
  const { name, phone, truckName, truckPlate, truckCapacity, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ message: "Нэр болон утас заавал байх ёстой" });
  }

  try {
    const driver = await prisma.driver.create({
      data: {
        name:          String(name).trim(),
        phone:         String(phone).trim(),
        truckName:     truckName?.trim() || null,
        truckPlate:    truckPlate?.trim() || null,
        truckCapacity: truckCapacity != null ? Number(truckCapacity) : 0,
        notes:         notes?.trim() || null,
      },
    });
    res.status(201).json(driver);
  } catch (err) {
    console.error("POST /admin/drivers error:", err);
    res.status(500).json({ message: "Жолооч үүсгэхэд алдаа гарлаа" });
  }
});

/* PUT /admin/drivers/:id — Жолоочийн мэдээлэл шинэчлэх */
router.put("/drivers/:id", auth, adminOnly, async (req: any, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  const { name, phone, truckName, truckPlate, truckCapacity, notes } = req.body;

  try {
    const updated = await prisma.driver.update({
      where: { id },
      data: {
        ...(name           !== undefined && { name: String(name).trim() }),
        ...(phone          !== undefined && { phone: String(phone).trim() }),
        ...(truckName      !== undefined && { truckName: truckName?.trim() || null }),
        ...(truckPlate     !== undefined && { truckPlate: truckPlate?.trim() || null }),
        ...(truckCapacity  !== undefined && { truckCapacity: Number(truckCapacity) }),
        ...(notes          !== undefined && { notes: notes?.trim() || null }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/drivers/:id error:", err);
    res.status(500).json({ message: "Жолоочийн мэдээлэл шинэчлэхэд алдаа гарлаа" });
  }
});

/* DELETE /admin/drivers/:id — Жолоочийг устгах */
router.delete("/drivers/:id", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    // Идэвхтэй захиалгатай байвал устгахгүй
    const activeOrders = await prisma.order.count({
      where: { driverId: id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    });

    if (activeOrders > 0) {
      return res.status(400).json({
        message: `${activeOrders} идэвхтэй захиалгатай байгаа тул устгах боломжгүй`,
      });
    }

    // Хуучин захиалгуудаа хадгалахын тулд жолоочийг устгахгүй,
    // зөвхөн isActive = false болгоно (soft delete).
    await prisma.driver.update({
      where: { id },
      data:  { isActive: false },
    });
    res.json({ message: "Жолооч устгагдлаа" });
  } catch (err) {
    console.error("DELETE /admin/drivers/:id error:", err);
    res.status(500).json({ message: "Жолооч устгахад алдаа гарлаа" });
  }
});

/* ════════════════════════════════════════════════════
   ЗАХИАЛГЫН ТӨЛӨВ ШИЛЖҮҮЛЭХ
═══════════════════════════════════════════════════════ */

/* PUT /admin/orders/:id/confirm — PENDING → CONFIRMED */
router.put("/orders/:id/confirm", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.status !== "PENDING") {
      return res.status(400).json({ message: "Зөвхөн хүлээгдэж буй захиалгыг баталгаажуулах боломжтой" });
    }

    const updated = await prisma.order.update({
      where: { id }, data: { status: "CONFIRMED" }, include: ORDER_INCLUDE,
    });

    setImmediate(async () => {
      try {
        if ((updated as any).user?.email) {
          await sendOrderConfirmedEmail(orderToEmailPayload(updated));
        }
      } catch (e) { console.error(`[Confirm] email failed #${id}:`, e); }
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id/confirm error:", err);
    res.status(500).json({ message: "Баталгаажуулахад алдаа гарлаа" });
  }
});

/* PUT /admin/orders/:id/assign — CONFIRMED → ASSIGNED */
router.put("/orders/:id/assign", auth, adminOnly, async (req: any, res) => {
  const id = Number(req.params.id);
  const { driverId } = req.body;

  if (isNaN(id))    return res.status(400).json({ message: "Буруу ID" });
  if (!driverId)    return res.status(400).json({ message: "driverId шаардлагатай" });

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.status !== "CONFIRMED") {
      return res.status(400).json({ message: "Зөвхөн баталгаажсан захиалгад жолооч хувиарлах боломжтой" });
    }

    const driver = await prisma.driver.findUnique({ where: { id: Number(driverId) } });
    if (!driver)              return res.status(404).json({ message: "Жолооч олдсонгүй" });
    if (!driver.isActive)     return res.status(400).json({ message: "Жолооч идэвхгүй байна" });

    const updated = await prisma.order.update({
      where: { id },
      data:  {
        status:     "ASSIGNED",
        driverId:   Number(driverId),
        assignedAt: new Date(),
      },
      include: ORDER_INCLUDE,
    });

    setImmediate(async () => {
      try {
        if ((updated as any).user?.email) {
          await sendOrderAssignedEmail({
            ...orderToEmailPayload(updated),
            driverName:  driver.name,
            driverPhone: driver.phone,
            truckName:   driver.truckName  ?? undefined,
            truckPlate:  driver.truckPlate ?? undefined,
          });
        }
      } catch (e) { console.error(`[Assign] email failed #${id}:`, e); }
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id/assign error:", err);
    res.status(500).json({ message: "Жолооч хувиарлахад алдаа гарлаа" });
  }
});

/* PUT /admin/orders/:id/start — ASSIGNED → IN_PROGRESS */
router.put("/orders/:id/start", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.status !== "ASSIGNED") {
      return res.status(400).json({ message: "Зөвхөн жолооч хувиарласан захиалгыг эхлүүлэх боломжтой" });
    }

    const updated = await prisma.order.update({
      where: { id }, data: { status: "IN_PROGRESS" }, include: ORDER_INCLUDE,
    });

    setImmediate(async () => {
      try {
        if ((updated as any).user?.email) {
          await sendOrderInProgressEmail(orderToEmailPayload(updated));
        }
      } catch (e) { console.error(`[Start] email failed #${id}:`, e); }
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id/start error:", err);
    res.status(500).json({ message: "Эхлүүлэхэд алдаа гарлаа" });
  }
});

/* PUT /admin/orders/:id/finish-service — IN_PROGRESS → AWAITING_PAYMENT */
router.put("/orders/:id/finish-service", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Зөвхөн явагдаж буй захиалгыг дуусгах боломжтой" });
    }

    const updated = await prisma.order.update({
      where: { id }, data: { status: "AWAITING_PAYMENT" }, include: ORDER_INCLUDE,
    });

    setImmediate(async () => {
      try {
        if ((updated as any).user?.email) {
          await sendInvoicePaymentEmail(orderToEmailPayload(updated));
        }
      } catch (e) { console.error(`[FinishService] email failed #${id}:`, e); }
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id/finish-service error:", err);
    res.status(500).json({ message: "Дуусгахад алдаа гарлаа" });
  }
});

/* PUT /admin/orders/:id/confirm-payment — AWAITING_PAYMENT → DONE */
router.put("/orders/:id/confirm-payment", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.status !== "AWAITING_PAYMENT") {
      return res.status(400).json({ message: "Зөвхөн төлбөр хүлээж буй захиалгыг баталгаажуулах боломжтой" });
    }

    const updated = await prisma.order.update({
      where: { id },
      data:  { status: "DONE", paid: true, paidAt: new Date() },
      include: ORDER_INCLUDE,
    });

    setImmediate(async () => {
      try {
        if ((updated as any).user?.email) {
          await sendOrderCompletedEmail({
            ...orderToEmailPayload(updated),
            paidAt: new Date().toLocaleString("mn-MN"),
          });
        }
      } catch (e) { console.error(`[ConfirmPayment] email failed #${id}:`, e); }
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id/confirm-payment error:", err);
    res.status(500).json({ message: "Төлбөр баталгаажуулахад алдаа гарлаа" });
  }
});

/* PUT /admin/orders/:id/cancel — Цуцлах */
router.put("/orders/:id/cancel", auth, adminOnly, async (req: any, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body;
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (existing.status === "DONE")      return res.status(400).json({ message: "Дууссан захиалгыг цуцлах боломжгүй" });
    if (existing.status === "CANCELED")  return res.status(400).json({ message: "Аль хэдийн цуцлагдсан" });

    const updated = await prisma.order.update({
      where: { id }, data: { status: "CANCELED" }, include: ORDER_INCLUDE,
    });

    setImmediate(async () => {
      try {
        if ((updated as any).user?.email) {
          await sendOrderCanceledEmail({
            ...orderToEmailPayload(updated),
            reason: reason || undefined,
          });
        }
      } catch (e) { console.error(`[Cancel] email failed #${id}:`, e); }
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id/cancel error:", err);
    res.status(500).json({ message: "Цуцлахад алдаа гарлаа" });
  }
});

/* PUT /admin/orders/:id — Generic статус шинэчлэх (legacy compat) */
router.put("/orders/:id", auth, adminOnly, async (req: any, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  const VALID = ["PENDING","CONFIRMED","ASSIGNED","IN_PROGRESS","AWAITING_PAYMENT","DONE","CANCELED"];
  if (!VALID.includes(status)) {
    return res.status(400).json({ message: "Буруу статус" });
  }

  try {
    const updated = await prisma.order.update({
      where: { id }, data: { status }, include: ORDER_INCLUDE,
    });
    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/orders/:id error:", err);
    res.status(500).json({ message: "Шинэчлэхэд алдаа гарлаа" });
  }
});

/* DELETE /admin/orders/:id */
router.delete("/orders/:id", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    // OrderAddOn эхлээд устгана (FK constraint)
    await prisma.orderAddOn.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });
    res.json({ message: "Захиалга устгагдлаа" });
  } catch (err) {
    console.error("DELETE /admin/orders/:id error:", err);
    res.status(500).json({ message: "Устгахад алдаа гарлаа" });
  }
});

/* ════════════════════════════════════════════════════
   GET /admin/users — Бүх хэрэглэгчдийн жагсаалт
   Захиалгын тоо, идэвхтэй эсэх зэрэг мэдээлэлтэй
═══════════════════════════════════════════════════════ */
router.get("/users", auth, adminOnly, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where:   { role: "USER" },  // зөвхөн USER, админ хасна
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        email:     true,
        name:      true,
        phone:     true,
        createdAt: true,
        _count:    { select: { orders: true } },
      },
    });

    // Идэвхтэй захиалгатай эсэхийг тооцох
    const result = await Promise.all(users.map(async (u: any) => {
      const activeOrdersCount = await prisma.order.count({
        where: {
          userId: u.id,
          status: { in: ["PENDING", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PAYMENT"] },
        },
      });

      const lastOrder = await prisma.order.findFirst({
        where:   { userId: u.id },
        orderBy: { createdAt: "desc" },
        select:  { createdAt: true, status: true },
      });

      return {
        id:               u.id,
        email:            u.email,
        name:             u.name,
        phone:            u.phone,
        createdAt:        u.createdAt,
        totalOrders:      u._count?.orders ?? 0,
        activeOrders:     activeOrdersCount,
        lastOrderAt:      lastOrder?.createdAt ?? null,
        lastOrderStatus:  lastOrder?.status ?? null,
        isActive:         activeOrdersCount > 0,
      };
    }));

    res.json(result);
  } catch (err: any) {
    console.error("GET /admin/users error:", err?.message || err);
    res.status(500).json({
      message: "Хэрэглэгчдийн жагсаалт татахад алдаа гарлаа",
      detail: process.env.NODE_ENV !== "production" ? err?.message : undefined,
    });
  }
});

/* ════════════════════════════════════════════════════
   GET /admin/analytics — Хэрэглэгчид болон захиалгуудын аналитик
═══════════════════════════════════════════════════════ */
router.get("/analytics", auth, adminOnly, async (_req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    // 1) Нийт хэрэглэгчид
    const totalUsers = await prisma.user.count({ where: { role: "USER" } });
    const newUsersToday = await prisma.user.count({
      where: { role: "USER", createdAt: { gte: today } },
    });
    const newUsersThisWeek = await prisma.user.count({
      where: { role: "USER", createdAt: { gte: weekAgo } },
    });
    const newUsersThisMonth = await prisma.user.count({
      where: { role: "USER", createdAt: { gte: monthAgo } },
    });

    // 2) Идэвхтэй (active захиалгатай) хэрэглэгчид
    const activeUsersList = await prisma.order.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PAYMENT"] },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    const activeUsers = activeUsersList.length;

    // 3) Хэзээ ч захиалга өгөөгүй хэрэглэгчид
    const allUsersWithOrders = await prisma.order.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });
    const usersWithOrdersIds = new Set(allUsersWithOrders.map((o: any) => o.userId));
    const inactiveUsers = totalUsers - usersWithOrdersIds.size;

    // 4) Захиалгын статистик
    const totalOrders = await prisma.order.count();
    const ordersToday = await prisma.order.count({
      where: { createdAt: { gte: today } },
    });
    const ordersThisWeek = await prisma.order.count({
      where: { createdAt: { gte: weekAgo } },
    });
    const ordersThisMonth = await prisma.order.count({
      where: { createdAt: { gte: monthAgo } },
    });

    // 5) Статус бүрийн тоо
    const statusCounts: Record<string, number> = {};
    const statuses = ["PENDING", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PAYMENT", "DONE", "CANCELED"];
    for (const s of statuses) {
      statusCounts[s] = await prisma.order.count({ where: { status: s } });
    }

    // 6) Орлого (DONE статуст байгаа захиалгуудын нийлбэр)
    const doneOrders = await prisma.order.findMany({
      where:  { status: "DONE" },
      select: { priceTotal: true, createdAt: true },
    });
    const totalRevenue = doneOrders.reduce((sum: number, o: any) => sum + Number(o.priceTotal || 0), 0);
    const revenueThisMonth = doneOrders
      .filter((o: any) => o.createdAt >= monthAgo)
      .reduce((sum: number, o: any) => sum + Number(o.priceTotal || 0), 0);

    // 7) Сүүлийн 7 өдрийн өдөр тутмын захиалгын тоо
    const dailyOrders: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const c = await prisma.order.count({
        where: { createdAt: { gte: d, lt: next } },
      });
      dailyOrders.push({
        date:  d.toLocaleDateString("mn-MN", { month: "short", day: "numeric" }),
        count: c,
      });
    }

    // 8) Хугацаатай статистик: 1сар / 6сар / 1жил
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    async function statsForPeriod(since: Date) {
      const orderCount = await prisma.order.count({
        where: { createdAt: { gte: since } },
      });
      const completedOrders = await prisma.order.findMany({
        where:  { createdAt: { gte: since }, status: "DONE" },
        select: { priceTotal: true },
      });
      const revenue = completedOrders.reduce(
        (sum: number, o: any) => sum + Number(o.priceTotal || 0),
        0
      );
      const distinctUsers = await prisma.order.findMany({
        where:    { createdAt: { gte: since } },
        select:   { userId: true },
        distinct: ["userId"],
      });
      return {
        orderCount,
        revenue,
        completedCount: completedOrders.length,
        activeUsers:    distinctUsers.length,
      };
    }

    const period1Month = await statsForPeriod(monthAgo);
    const period6Month = await statsForPeriod(sixMonthsAgo);
    const period1Year  = await statsForPeriod(yearAgo);

    res.json({
      users: {
        total:       totalUsers,
        active:      activeUsers,        // active захиалгатай
        inactive:    inactiveUsers,      // хэзээ ч захиалга өгөөгүй
        newToday:    newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
      },
      orders: {
        total:        totalOrders,
        today:        ordersToday,
        thisWeek:     ordersThisWeek,
        thisMonth:    ordersThisMonth,
        byStatus:     statusCounts,
        dailyLast7:   dailyOrders,
      },
      revenue: {
        total:     totalRevenue,
        thisMonth: revenueThisMonth,
      },
      periods: {
        oneMonth:   period1Month,
        sixMonths:  period6Month,
        oneYear:    period1Year,
      },
    });
  } catch (err: any) {
    console.error("GET /admin/analytics error:", err?.message || err);
    res.status(500).json({
      message: "Аналитик татахад алдаа гарлаа",
      detail: process.env.NODE_ENV !== "production" ? err?.message : undefined,
    });
  }
});

/* GET /admin/users/:id — нэг хэрэглэгчийн дэлгэрэнгүй + захиалгууд */
router.get("/users/:id", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const user = await prisma.user.findUnique({
      where:  { id },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });

    const orders = await prisma.order.findMany({
      where:   { userId: id },
      orderBy: { createdAt: "desc" },
      include: {
        serviceType: true,
        zone:        true,
        slot:        true,
        addOns:      { include: { addOn: true } },
      },
    });

    res.json({ user, orders });
  } catch (err: any) {
    console.error("GET /admin/users/:id error:", err?.message || err);
    res.status(500).json({ message: "Хэрэглэгчийн мэдээлэл татахад алдаа гарлаа" });
  }
});

/* ════════════════════════════════════════════════════
   GET /admin/report/csv?period=1month|6months|1year
   Excel-д нээгдэх CSV (UTF-8 BOM-той) тайлан
═══════════════════════════════════════════════════════ */
router.get("/report/csv", auth, adminOnly, async (req, res) => {
  const period = String(req.query.period || "1month");

  // Хугацааны эхлэл
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  if (period === "6months") {
    since.setMonth(since.getMonth() - 6);
  } else if (period === "1year") {
    since.setFullYear(since.getFullYear() - 1);
  } else {
    since.setMonth(since.getMonth() - 1);
  }

  try {
    const orders = await prisma.order.findMany({
      where:   { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      include: {
        user:        { select: { email: true, name: true, phone: true, companyName: true } },
        serviceType: true,
        zone:        true,
        slot:        true,
        addOns:      { include: { addOn: true } },
      },
    });

    // CSV-д хадгалах багана
    const headers = [
      "ID",
      "Огноо",
      "Хэрэглэгч",
      "Имэйл",
      "Утас",
      "Байгууллага",
      "Үйлчилгээ",
      "Дүүрэг",
      "Хаяг",
      "Хэмжээ",
      "Нэгж",
      "Цаг",
      "Огноо",
      "Нэмэлт",
      "Үнэ",
      "Статус",
      "Төлсөн эсэх",
    ];

    const STATUS_LABEL_MAP: Record<string, string> = {
      PENDING:          "Хүлээгдэж буй",
      CONFIRMED:        "Баталгаажсан",
      ASSIGNED:         "Жолооч хувиарласан",
      IN_PROGRESS:      "Явагдаж буй",
      AWAITING_PAYMENT: "Төлбөр хүлээж буй",
      DONE:             "Дууссан",
      CANCELED:         "Цуцлагдсан",
    };

    // CSV-д escape хийх (нэг талбарт comma, quote байж магадгүй)
    const csvEscape = (val: any): string => {
      const s = val == null ? "" : String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = orders.map((o: any) => {
      const slotLabel = o.slot
        ? `${String(o.slot.startTime).slice(0, 5)} - ${String(o.slot.endTime).slice(0, 5)}`
        : "—";
      const addOnsLabel = (o.addOns || [])
        .map((oa: any) => oa.addOn?.name || "")
        .filter(Boolean)
        .join(" | ");

      return [
        o.id,
        new Date(o.createdAt).toLocaleString("mn-MN"),
        o.user?.name || "—",
        o.user?.email || "—",
        o.user?.phone || "—",
        o.user?.companyName || "—",
        o.serviceType?.name || "—",
        o.zone?.name || "—",
        o.address || "—",
        o.volume,
        o.volumeUnit || "TON",
        slotLabel,
        o.date || "—",
        addOnsLabel || "—",
        Number(o.priceTotal || 0).toLocaleString("mn-MN") + "₮",
        STATUS_LABEL_MAP[o.status] || o.status,
        o.paid ? "Тийм" : "Үгүй",
      ].map(csvEscape).join(",");
    });

    // UTF-8 BOM (Excel дээр Mongolian зөв харуулахын тулд)
    const BOM = "\uFEFF";
    const csv = BOM + headers.join(",") + "\n" + rows.join("\n");

    const filename = `sewage_report_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) {
    console.error("GET /admin/report/csv error:", err?.message || err);
    res.status(500).json({ message: "Тайлан үүсгэхэд алдаа гарлаа" });
  }
});

export default router;
