"use strict";
// src/controllers/orderController.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getAllOrders = exports.cancelOrder = exports.getOrderById = exports.getMyOrders = exports.createOrder = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const emailService_1 = require("../services/emailService");
const ORDER_INCLUDE = {
    serviceType: true,
    zone: true,
    slot: true,
    addOns: { include: { addOn: true } },
};
// ── Frontend ID → Монгол нэр ──
const SERVICE_NAME_MAP = {
    BOHIR_US: "💧 Бохир ус тээвэр",
    LAG: "🔄 Лаг соруулах",
    SEPTIK: "🏗️ Септик соруулах",
    UGALGA: "✨ Угаалга",
};
function resolvePrice(order) {
    const t = Number(order.totalPrice ?? 0);
    const p = Number(order.priceTotal ?? 0);
    return Math.max(t, p);
}
function withPrice(order) {
    const price = resolvePrice(order);
    return { ...order, totalPrice: price, priceTotal: price };
}
// POST /orders
const createOrder = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });
        const { serviceTypeId, zoneId, slotId, address, volume, volumeUnit, lat, lng, addOnIds = [], customerName, customerPhone, notes, pitStatus, pitType, date, district, unit, timeSlot, extras = [], totalPrice, basePrice, serviceType: serviceTypeLabel, } = req.body;
        // ── DEBUG: pitStatus/pitType яг ямар утгаар ирж байгааг лог хийнэ ──
        console.log("[createOrder] pitStatus:", JSON.stringify(pitStatus));
        console.log("[createOrder] pitType:  ", JSON.stringify(pitType));
        console.log("[createOrder] req.body keys:", Object.keys(req.body));
        if (!serviceTypeId || !zoneId || !slotId || !address || !volume) {
            return res.status(400).json({ message: "Заавал бөглөх талбарууд дутуу байна" });
        }
        const order = await prisma_1.default.$transaction(async (tx) => {
            const slot = await tx.timeSlot.findUnique({ where: { id: Number(slotId) } });
            if (!slot)
                throw new Error("SLOT_NOT_FOUND");
            if (slot.bookedCount >= slot.capacity)
                throw new Error("SLOT_FULL");
            await tx.timeSlot.update({
                where: { id: slot.id },
                data: { bookedCount: { increment: 1 } },
            });
            const addOns = await tx.addOnService.findMany({
                where: { id: { in: addOnIds.map(Number) }, isActive: true },
            });
            let addOnTotal = 0;
            for (const a of addOns) {
                addOnTotal += a.priceType === "FIXED" ? a.priceValue : 0;
            }
            const BASE_PRICE = 100000;
            const VOLUME_UNIT_PRICE = 5000;
            const subtotal = BASE_PRICE + Math.round(Number(volume) * VOLUME_UNIT_PRICE);
            const computedTotal = subtotal + addOnTotal;
            const finalPrice = Number(totalPrice ?? computedTotal);
            return await tx.order.create({
                data: {
                    userId: Number(userId),
                    address: String(address),
                    volume: Number(volume),
                    volumeUnit: volumeUnit === "M3" ? "M3" : "TON",
                    lat: lat ?? null,
                    lng: lng ?? null,
                    status: "PENDING",
                    priceSubtotal: subtotal,
                    priceTotal: finalPrice,
                    totalPrice: finalPrice,
                    serviceTypeId: Number(serviceTypeId),
                    zoneId: Number(zoneId),
                    slotId: Number(slotId),
                    customerName: customerName ?? null,
                    customerPhone: customerPhone ?? null,
                    notes: notes ?? null,
                    pitStatus: pitStatus ?? null,
                    pitType: pitType ?? null,
                    date: date ?? null,
                    district: district ?? "БЗД",
                    unit: unit ?? "тонн",
                    timeSlot: timeSlot ?? "",
                    extras: Array.isArray(extras) ? extras : [],
                    addOns: {
                        create: addOnIds.map((id) => ({ addOnId: Number(id) })),
                    },
                },
                include: ORDER_INCLUDE,
            });
        });
        // ── Admin имэйл ──
        try {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) {
                const user = await prisma_1.default.user.findUnique({
                    where: { id: Number(userId) },
                    select: { email: true, name: true, phone: true },
                });
                const o = order;
                const finalPrice = resolvePrice(o);
                const slotLabel = o.slot
                    ? `${String(o.slot.startTime ?? "").slice(0, 5)} – ${String(o.slot.endTime ?? "").slice(0, 5)}`
                    : String(o.timeSlot ?? "");
                const svcObj = o.serviceType;
                const emailServiceName = (typeof serviceTypeLabel === "string" && serviceTypeLabel.trim())
                    ? serviceTypeLabel.trim()
                    : (svcObj?.name ?? svcObj?.label ?? SERVICE_NAME_MAP[String(svcObj?.code ?? svcObj?.id ?? "")] ?? String(svcObj?.name ?? ""));
                const addOnList = (o.addOns ?? []).map((oa) => ({
                    name: String(oa.addOn.name),
                    price: oa.addOn.priceType === "FIXED"
                        ? Number(oa.addOn.priceValue)
                        : Math.round((finalPrice * Number(oa.addOn.priceValue)) / 100),
                }));
                const addOnTotal = addOnList.reduce((s, a) => s + a.price, 0);
                const emailBasePrice = basePrice != null
                    ? Number(basePrice)
                    : Math.max(0, finalPrice - addOnTotal);
                // ── pitStatus/pitType: req.body → DB order аль байгааг авна ──
                // String() хийхдээ "undefined" болохоос сэргийлж тусад нь шалгана
                const rawPitStatus = pitStatus ?? o.pitStatus;
                const rawPitType = pitType ?? o.pitType;
                const emailPitStatus = (rawPitStatus != null && String(rawPitStatus).trim() !== "")
                    ? String(rawPitStatus).trim()
                    : undefined;
                const emailPitType = (rawPitType != null && String(rawPitType).trim() !== "")
                    ? String(rawPitType).trim()
                    : undefined;
                console.log("[createOrder] email pitStatus:", emailPitStatus);
                console.log("[createOrder] email pitType:  ", emailPitType);
                await (0, emailService_1.sendAdminOrderNotification)({
                    adminEmail,
                    orderId: o.id,
                    customerEmail: user?.email ?? "",
                    customerName: o.customerName ?? user?.name ?? "",
                    customerPhone: o.customerPhone ?? user?.phone ?? "",
                    address: o.address,
                    pitStatus: emailPitStatus,
                    pitType: emailPitType,
                    serviceType: emailServiceName,
                    zone: o.zone?.name ?? String(o.district ?? district ?? ""),
                    volume: o.volume,
                    volumeUnit: o.volumeUnit,
                    date: String(o.date ?? date ?? ""),
                    slot: slotLabel,
                    notes: o.notes ?? undefined,
                    addOns: addOnList,
                    priceSubtotal: emailBasePrice,
                    priceTotal: finalPrice,
                    createdAt: new Date(o.createdAt).toLocaleString("mn-MN"),
                    dashboardUrl: `${process.env.DASHBOARD_URL ?? "http://localhost:3000"}/admin/orders/${o.id}`,
                });
            }
        }
        catch (emailErr) {
            console.warn("[createOrder] Admin имэйл илгээхэд алдаа:", emailErr);
        }
        return res.status(201).json(withPrice(order));
    }
    catch (err) {
        const msg = String(err?.message || "");
        if (msg === "SLOT_FULL")
            return res.status(409).json({ message: "Сонгосон цаг дүүрсэн байна" });
        if (msg === "SLOT_NOT_FOUND")
            return res.status(404).json({ message: "Цагийн slot олдсонгүй" });
        console.error("createOrder error:", err);
        return res.status(500).json({ message: "Захиалга үүсгэхэд алдаа гарлаа" });
    }
};
exports.createOrder = createOrder;
// GET /orders/my
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });
        const orders = await prisma_1.default.order.findMany({
            where: { userId: Number(userId) },
            orderBy: { createdAt: "desc" },
            include: ORDER_INCLUDE,
        });
        return res.json(orders.map(withPrice));
    }
    catch (err) {
        console.error("getMyOrders error:", err);
        return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
    }
};
exports.getMyOrders = getMyOrders;
// GET /orders/:id
const getOrderById = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ message: "Буруу ID" });
        const order = await prisma_1.default.order.findUnique({
            where: { id },
            include: ORDER_INCLUDE,
        });
        if (!order)
            return res.status(404).json({ message: "Захиалга олдсонгүй" });
        const role = req.user?.role;
        if (order.userId !== Number(userId) && role !== "ADMIN") {
            return res.status(403).json({ message: "Энэ захиалгыг харах эрх байхгүй" });
        }
        return res.json(withPrice(order));
    }
    catch (err) {
        console.error("getOrderById error:", err);
        return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
    }
};
exports.getOrderById = getOrderById;
// PUT /orders/:id/cancel
const cancelOrder = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ message: "Буруу ID" });
        const order = await prisma_1.default.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ message: "Захиалга олдсонгүй" });
        if (order.userId !== Number(userId))
            return res.status(403).json({ message: "Эрх байхгүй" });
        if (order.status !== "PENDING") {
            return res.status(409).json({ message: "Зөвхөн хүлээгдэж буй захиалгыг цуцлах боломжтой" });
        }
        if (!order.slotId)
            return res.status(400).json({ message: "Захиалгын slot олдсонгүй" });
        await prisma_1.default.$transaction([
            prisma_1.default.timeSlot.update({
                where: { id: order.slotId },
                data: { bookedCount: { decrement: 1 } },
            }),
            prisma_1.default.order.update({
                where: { id },
                data: { status: "CANCELED" },
            }),
        ]);
        return res.json({ message: "Захиалга амжилттай цуцлагдлаа" });
    }
    catch (err) {
        console.error("cancelOrder error:", err);
        return res.status(500).json({ message: "Цуцлахад алдаа гарлаа" });
    }
};
exports.cancelOrder = cancelOrder;
// GET /orders (ADMIN)
const getAllOrders = async (req, res) => {
    try {
        const orders = await prisma_1.default.order.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, email: true, name: true, phone: true } },
                ...ORDER_INCLUDE,
            },
        });
        return res.json(orders.map(withPrice));
    }
    catch (err) {
        console.error("getAllOrders error:", err);
        return res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
    }
};
exports.getAllOrders = getAllOrders;
// PATCH /orders/:id/status (ADMIN)
const updateOrderStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        const valid = ["PENDING", "CONFIRMED", "IN_PROGRESS", "DONE", "CANCELED", "PAYMENT_PENDING"];
        if (!valid.includes(status)) {
            return res.status(400).json({ message: "Буруу статус" });
        }
        const order = await prisma_1.default.order.update({
            where: { id },
            data: { status },
            include: ORDER_INCLUDE,
        });
        return res.json(withPrice(order));
    }
    catch (err) {
        console.error("updateOrderStatus error:", err);
        return res.status(500).json({ message: "Статус шинэчлэхэд алдаа гарлаа" });
    }
};
exports.updateOrderStatus = updateOrderStatus;
