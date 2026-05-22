import { Request, Response } from "express";
import prisma from "../prisma";
import {
  sendAdminOrderNotification,
  sendCustomerOrderReceived,
} from "../services/emailService";
import {
  sendOrderConfirmedEmail,
  sendOrderAssignedEmail,
  sendOrderInProgressEmail,
  sendInvoicePaymentEmail,
  sendOrderCompletedEmail,
  sendOrderCanceledEmail,
} from "../services/statusEmails";

const ORDER_INCLUDE = {
  serviceType: true,
  zone:        true,
  slot:        true,
  addOns:      { include: { addOn: true } },
} as const;

// ── Frontend ID → Монгол нэр ──
const SERVICE_NAME_MAP: Record<string, string> = {
  BOHIR_US: "💧 Бохир ус тээвэр",
  LAG:      "🔄 Лаг соруулах",
  SEPTIK:   "🏗️ Септик соруулах",
  UGALGA:   "✨ Угаалга",
};

function resolvePrice(order: any): number {
  const t = Number(order.totalPrice ?? 0);
  const p = Number(order.priceTotal ?? 0);
  return Math.max(t, p);
}

function withPrice<T extends object>(order: T): T & { totalPrice: number } {
  const price = resolvePrice(order);
  return { ...order, totalPrice: price, priceTotal: price };
}

/**
 * Email payload helper — order дотроос статус email-д ашиглах нийтлэг payload
 */
function buildStatusBasePayload(order: any, userEmail: string) {
  const slotLabel = order.slot
    ? `${String(order.slot.startTime ?? "").slice(0, 5)} – ${String(order.slot.endTime ?? "").slice(0, 5)}`
    : String(order.timeSlot ?? "");

  const finalPrice    = resolvePrice(order);
  const customerName  = order.customerName ?? order.user?.name ?? "";
  const svc           = order.serviceType as any;
  const serviceTypeName =
    svc?.name ?? svc?.label ?? SERVICE_NAME_MAP[String(svc?.code ?? "")] ?? "Бохир ус тээвэр";
  const districtName  = (order.zone as any)?.name ?? order.district ?? "";

  return {
    to:          userEmail,
    customerName,
    orderId:     order.id,
    serviceType: serviceTypeName,
    district:    districtName,
    address:     order.address,
    date:        String(order.date ?? ""),
    timeSlot:    slotLabel,
    totalPrice:  finalPrice,
    appUrl:      process.env.APP_URL,
  };
}

/**
 * Order дээрх addOn-уудыг сайжруулсан price-той list болгож гаргана
 */
function buildAddOnList(order: any, finalPrice: number) {
  return (order.addOns ?? []).map((oa: any) => ({
    name:  String(oa.addOn.name),
    price: oa.addOn.priceType === "FIXED"
      ? Number(oa.addOn.priceValue)
      : Math.round((finalPrice * Number(oa.addOn.priceValue)) / 100),
  }));
}

// ══════════════════════════════════════════════════════════════════
// POST /orders
// ══════════════════════════════════════════════════════════════════
export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });

    const {
      serviceTypeId,
      zoneId,
      slotId,
      address,
      volume,
      volumeUnit,
      lat,
      lng,
      addOnIds = [],
      customerName,
      customerPhone,
      notes,
      pitStatus,
      pitType,
      date,
      district,
      unit,
      timeSlot,
      extras = [],
      totalPrice,
      basePrice,
      serviceType: serviceTypeLabel,
    } = req.body;

    console.log("[createOrder] pitStatus:", JSON.stringify(pitStatus));
    console.log("[createOrder] pitType:  ", JSON.stringify(pitType));
    console.log("[createOrder] req.body keys:", Object.keys(req.body));

    if (!serviceTypeId || !zoneId || !slotId || !address || !volume) {
      return res.status(400).json({ message: "Заавал бөглөх талбарууд дутуу байна" });
    }

    const order = await prisma.$transaction(async (tx) => {
      const slot = await tx.timeSlot.findUnique({ where: { id: Number(slotId) } });
      if (!slot) throw new Error("SLOT_NOT_FOUND");
      if (slot.bookedCount >= slot.capacity) throw new Error("SLOT_FULL");

      await tx.timeSlot.update({
        where: { id: slot.id },
        data:  { bookedCount: { increment: 1 } },
      });

      const addOns = await tx.addOnService.findMany({
        where: { id: { in: (addOnIds as number[]).map(Number) }, isActive: true },
      });

      let addOnTotal = 0;
      for (const a of addOns) {
        addOnTotal += a.priceType === "FIXED" ? a.priceValue : 0;
      }

      const BASE_PRICE        = 100_000;
      const VOLUME_UNIT_PRICE =   5_000;
      const subtotal          = BASE_PRICE + Math.round(Number(volume) * VOLUME_UNIT_PRICE);
      const computedTotal     = subtotal + addOnTotal;
      const finalPrice        = Number(totalPrice ?? computedTotal);

      return await (tx.order.create as any)({
        data: {
          userId:        Number(userId),
          address:       String(address),
          volume:        Number(volume),
          volumeUnit:    volumeUnit === "M3" ? "M3" : "TON",
          lat:           lat  ?? null,
          lng:           lng  ?? null,
          status:        "PENDING",
          priceSubtotal: subtotal,
          priceTotal:    finalPrice,
          totalPrice:    finalPrice,
          serviceTypeId: Number(serviceTypeId),
          zoneId:        Number(zoneId),
          slotId:        Number(slotId),
          customerName:  customerName  ?? null,
          customerPhone: customerPhone ?? null,
          notes:         notes         ?? null,
          pitStatus:     pitStatus     ?? null,
          pitType:       pitType       ?? null,
          date:          date          ?? null,
          district:      district      ?? "БЗД",
          unit:          unit          ?? "тонн",
          timeSlot:      timeSlot      ?? "",
          extras:        Array.isArray(extras) ? extras : [],
          addOns: {
            create: (addOnIds as number[]).map((id) => ({ addOnId: Number(id) })),
          },
        },
        include: ORDER_INCLUDE,
      });
    });

    // ══════════════════════════════════════════════
    // EMAIL ИЛГЭЭХ
    //   1) Admin руу — шинэ захиалга
    //   2) Customer руу — хүлээн авсан баталгаа
    // ══════════════════════════════════════════════
    try {
      const o          = order as any;
      const finalPrice = resolvePrice(o);
      const user = await prisma.user.findUnique({
        where:  { id: Number(userId) },
        select: { email: true, name: true, phone: true },
      });

      const slotLabel = o.slot
        ? `${String(o.slot.startTime ?? "").slice(0, 5)} – ${String(o.slot.endTime ?? "").slice(0, 5)}`
        : String(o.timeSlot ?? "");

      const svcObj = o.serviceType as any;
      const emailServiceName =
        (typeof serviceTypeLabel === "string" && serviceTypeLabel.trim())
          ? serviceTypeLabel.trim()
          : (svcObj?.name ?? svcObj?.label ?? SERVICE_NAME_MAP[String(svcObj?.code ?? svcObj?.id ?? "")] ?? String(svcObj?.name ?? ""));

      const addOnList  = buildAddOnList(o, finalPrice);
      const addOnTotal = addOnList.reduce((s: number, a: any) => s + a.price, 0);

      const emailBasePrice = basePrice != null
        ? Number(basePrice)
        : Math.max(0, finalPrice - addOnTotal);

      const rawPitStatus = pitStatus ?? o.pitStatus;
      const rawPitType   = pitType   ?? o.pitType;
      const emailPitStatus = (rawPitStatus != null && String(rawPitStatus).trim() !== "")
        ? String(rawPitStatus).trim() : undefined;
      const emailPitType = (rawPitType != null && String(rawPitType).trim() !== "")
        ? String(rawPitType).trim() : undefined;

      const districtName = (o.zone as any)?.name ?? String(o.district ?? district ?? "");
      const customerEmail = user?.email ?? "";
      const customerNameFinal = o.customerName ?? user?.name ?? "";

      // ── 1) ADMIN EMAIL ──
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        try {
          await sendAdminOrderNotification({
            adminEmail,
            orderId:       o.id,
            customerEmail,
            customerName:  customerNameFinal,
            customerPhone: o.customerPhone ?? user?.phone ?? "",
            address:       o.address,
            pitStatus:     emailPitStatus,
            pitType:       emailPitType,
            serviceType:   emailServiceName,
            zone:          districtName,
            volume:        o.volume,
            volumeUnit:    o.volumeUnit,
            date:          String(o.date ?? date ?? ""),
            slot:          slotLabel,
            notes:         o.notes ?? undefined,
            addOns:        addOnList,
            priceSubtotal: emailBasePrice,
            priceTotal:    finalPrice,
            createdAt:     new Date(o.createdAt).toLocaleString("mn-MN"),
            dashboardUrl:  `${process.env.DASHBOARD_URL ?? process.env.APP_URL ?? "http://localhost:3000"}/admin/orders/${o.id}`,
          });
        } catch (e) {
          console.warn("[createOrder] admin email алдаа:", e);
        }
      }

      // ── 2) CUSTOMER EMAIL ──
      if (customerEmail) {
        try {
          await sendCustomerOrderReceived({
            customerEmail,
            customerName:  customerNameFinal,
            orderId:       o.id,
            serviceType:   emailServiceName,
            district:      districtName,
            address:       o.address,
            volume:        o.volume,
            volumeUnit:    o.volumeUnit,
            date:          String(o.date ?? date ?? ""),
            timeSlot:      slotLabel,
            priceSubtotal: emailBasePrice,
            addOns:        addOnList,
            priceTotal:    finalPrice,
          });
        } catch (e) {
          console.warn("[createOrder] customer email алдаа:", e);
        }
      }
    } catch (emailErr) {
      console.warn("[createOrder] Имэйл блок алдаа:", emailErr);
    }

    return res.status(201).json(withPrice(order));
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg === "SLOT_FULL")      return res.status(409).json({ message: "Сонгосон цаг дүүрсэн байна" });
    if (msg === "SLOT_NOT_FOUND") return res.status(404).json({ message: "Цагийн slot олдсонгүй" });
    console.error("createOrder error:", err);
    return res.status(500).json({ message: "Захиалга үүсгэхэд алдаа гарлаа" });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /orders/my
// ══════════════════════════════════════════════════════════════════
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });

    const orders = await prisma.order.findMany({
      where:   { userId: Number(userId) },
      orderBy: { createdAt: "desc" },
      include: ORDER_INCLUDE,
    });

    return res.json(orders.map(withPrice));
  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /orders/:id
// ══════════════════════════════════════════════════════════════════
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

    const order = await prisma.order.findUnique({
      where:   { id },
      include: ORDER_INCLUDE,
    });

    if (!order) return res.status(404).json({ message: "Захиалга олдсонгүй" });

    const role = (req as any).user?.role;
    if (order.userId !== Number(userId) && role !== "ADMIN") {
      return res.status(403).json({ message: "Энэ захиалгыг харах эрх байхгүй" });
    }

    return res.json(withPrice(order));
  } catch (err) {
    console.error("getOrderById error:", err);
    return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
  }
};

// ══════════════════════════════════════════════════════════════════
// PUT /orders/:id/cancel  (USER)
// ══════════════════════════════════════════════════════════════════
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

    const order = await prisma.order.findUnique({
      where:   { id },
      include: { ...ORDER_INCLUDE, user: { select: { email: true, name: true } } },
    });
    if (!order) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (order.userId !== Number(userId)) return res.status(403).json({ message: "Эрх байхгүй" });
    if (order.status !== "PENDING") {
      return res.status(409).json({ message: "Зөвхөн хүлээгдэж буй захиалгыг цуцлах боломжтой" });
    }
    if (!order.slotId) return res.status(400).json({ message: "Захиалгын slot олдсонгүй" });

    await prisma.$transaction([
      prisma.timeSlot.update({
        where: { id: order.slotId },
        data:  { bookedCount: { decrement: 1 } },
      }),
      prisma.order.update({
        where: { id },
        data:  { status: "CANCELED" },
      }),
    ]);

    // Хэрэглэгчид цуцалсан email явуулна
    try {
      const o = order as any;
      const userEmail = o.user?.email;
      if (userEmail) {
        const base = buildStatusBasePayload(o, userEmail);
        await sendOrderCanceledEmail({ ...base, reason: "Хэрэглэгч өөрөө цуцалсан" });
      }
    } catch (e) {
      console.warn("[cancelOrder] email алдаа:", e);
    }

    return res.json({ message: "Захиалга амжилттай цуцлагдлаа" });
  } catch (err) {
    console.error("cancelOrder error:", err);
    return res.status(500).json({ message: "Цуцлахад алдаа гарлаа" });
  }
};

// ══════════════════════════════════════════════════════════════════
// GET /orders (ADMIN)
// ══════════════════════════════════════════════════════════════════
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
        ...ORDER_INCLUDE,
      },
    });
    return res.json(orders.map(withPrice));
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
  }
};

// ══════════════════════════════════════════════════════════════════
// PATCH /orders/:id/status (ADMIN)
// status өөрчлөгдөх бүрт хэрэглэгчид имэйл явуулна
// ══════════════════════════════════════════════════════════════════
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const {
      status,
      driverName,
      driverPhone,
      truckName,
      truckPlate,
      reason,
    } = req.body;

    const valid = [
      "PENDING",
      "CONFIRMED",
      "ASSIGNED",
      "IN_PROGRESS",
      "AWAITING_PAYMENT",
      "PAYMENT_PENDING",
      "DONE",
      "CANCELED",
    ];
    if (!valid.includes(status)) {
      return res.status(400).json({ message: "Буруу статус" });
    }

    const order = await prisma.order.update({
      where:   { id },
      data:    { status },
      include: {
        ...ORDER_INCLUDE,
        user: { select: { email: true, name: true, phone: true } },
      },
    });

    // ── Хэрэглэгчид статус-аас хамаараад email явуулна ──
    try {
      const o = order as any;
      const userEmail = o.user?.email;

      if (!userEmail) {
        console.warn(`[updateOrderStatus #${o.id}] user email олдсонгүй`);
      } else {
        const base       = buildStatusBasePayload(o, userEmail);
        const finalPrice = resolvePrice(o);
        const addOnList  = buildAddOnList(o, finalPrice);
        const addOnTotal = addOnList.reduce((s: number, a: any) => s + a.price, 0);

        switch (status) {
          case "CONFIRMED":
            await sendOrderConfirmedEmail(base);
            break;

          case "ASSIGNED":
            await sendOrderAssignedEmail({
              ...base,
              driverName:  driverName ?? "Хувиарласан жолооч",
              driverPhone: driverPhone ?? "—",
              truckName,
              truckPlate,
            });
            break;

          case "IN_PROGRESS":
            await sendOrderInProgressEmail(base);
            break;

          case "AWAITING_PAYMENT":
          case "PAYMENT_PENDING":
            await sendInvoicePaymentEmail({
              ...base,
              volume:        o.volume,
              volumeUnit:    o.volumeUnit,
              priceSubtotal: Math.max(0, finalPrice - addOnTotal),
              addOns:        addOnList,
            });
            break;

          case "DONE":
            await sendOrderCompletedEmail({
              to:           userEmail,
              customerName: base.customerName,
              orderId:      o.id,
              serviceType:  base.serviceType,
              totalPrice:   finalPrice,
              paidAt:       new Date().toLocaleString("mn-MN"),
              appUrl:       process.env.APP_URL,
            });
            break;

          case "CANCELED":
            await sendOrderCanceledEmail({ ...base, reason });
            break;

          case "PENDING":
            // PENDING рүү буцаах нь түгээмэл биш — email явуулахгүй
            break;
        }

        console.log(`[updateOrderStatus #${o.id}] ✅ ${status} email явуулсан → ${userEmail}`);
      }
    } catch (emailErr) {
      console.warn(`[updateOrderStatus #${id}] email алдаа:`, emailErr);
      // Email алдаа гарсан ч status шинэчлэгдсэн, response буцаах
    }

    return res.json(withPrice(order));
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    return res.status(500).json({ message: "Статус шинэчлэхэд алдаа гарлаа" });
  }
};