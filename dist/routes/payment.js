"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const statusEmails_1 = require("../services/statusEmails");
const router = (0, express_1.Router)();
const ORDER_INCLUDE = {
    user: { select: { id: true, email: true, name: true, phone: true } },
    serviceType: true,
    zone: true,
    slot: true,
    addOns: { include: { addOn: true } },
};
/* ════════════════════════════════════════════════════
   POST /payment/:orderId/mark-paid
   Хэрэглэгч өөрөө "Төлбөр шилжүүлсэн" гэж тэмдэглэх
   (Admin дараа нь баталгаажуулах хэрэгтэй)
════════════════════════════════════════════════════ */
router.post("/:orderId/mark-paid", auth_1.auth, async (req, res) => {
    const orderId = Number(req.params.orderId);
    const { transactionRef, note } = req.body;
    if (isNaN(orderId))
        return res.status(400).json({ message: "Буруу ID" });
    try {
        const order = await prisma_1.default.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
        if (!order)
            return res.status(404).json({ message: "Захиалга олдсонгүй" });
        // Зөвхөн өөрийн захиалгад үйлдэх боломжтой
        if (order.userId !== req.user.id && req.user.role !== "ADMIN")
            return res.status(403).json({ message: "Энэ захиалгад хандах эрхгүй" });
        if (order.status !== "AWAITING_PAYMENT")
            return res.status(400).json({
                message: "Зөвхөн төлбөр хүлээж буй захиалгад тэмдэглэх боломжтой"
            });
        if (order.paid)
            return res.status(400).json({ message: "Энэ захиалгын төлбөр аль хэдийн төлөгдсөн байна" });
        // notes-д хэрэглэгчийн зурвасыг нэмэх (admin харах)
        const updatedNote = [
            order.notes,
            `[${new Date().toLocaleString("mn-MN")}] Хэрэглэгч төлсөн гэж тэмдэглэв.`,
            transactionRef ? `Гүйлгээний дугаар: ${transactionRef}` : "",
            note ? `Тэмдэглэл: ${note}` : "",
        ].filter(Boolean).join("\n");
        const updated = await prisma_1.default.order.update({
            where: { id: orderId },
            data: { notes: updatedNote },
            include: ORDER_INCLUDE,
        });
        // Админ руу мэдэгдэх имэйл (fire-and-forget)
        setImmediate(async () => {
            try {
                const adminEmail = process.env.ADMIN_EMAIL;
                if (!adminEmail)
                    return;
                await (0, statusEmails_1.sendAdminPaymentNotice)({
                    adminEmail,
                    orderId: updated.id,
                    customerName: updated.user?.name || updated.customerName || "—",
                    customerEmail: updated.user?.email || "—",
                    customerPhone: updated.user?.phone || updated.customerPhone || "—",
                    address: updated.address,
                    serviceType: updated.serviceType?.name || "—",
                    priceTotal: Number(updated.priceTotal || updated.totalPrice || 0),
                    transactionRef,
                    userNote: note,
                    dashboardUrl: `${process.env.ADMIN_DASHBOARD_URL ?? "http://localhost:3000"}/admin`,
                });
            }
            catch (err) {
                console.error(`[Payment] Admin email failed #${updated.id}:`, err);
            }
        });
        res.json({
            message: "Төлсөн гэж амжилттай тэмдэглэлээ. Админ удахгүй баталгаажуулах болно.",
            order: updated,
        });
    }
    catch (err) {
        console.error("POST /payment/mark-paid error:", err);
        res.status(500).json({ message: "Тэмдэглэхэд алдаа гарлаа" });
    }
});
exports.default = router;
