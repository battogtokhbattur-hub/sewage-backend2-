"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/* ════════════════════════════════════════════════════
   GET /profile — миний профайл
═══════════════════════════════════════════════════════ */
router.get("/", auth_1.auth, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, email: true, name: true, phone: true,
                companyName: true, address: true, role: true,
                createdAt: true,
            },
        });
        if (!user)
            return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
        // Хэрэглэгчийн statistics нэмж буцаах
        const totalOrders = await prisma_1.default.order.count({ where: { userId: user.id } });
        const activeOrders = await prisma_1.default.order.count({
            where: {
                userId: user.id,
                status: { in: ["PENDING", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PAYMENT"] },
            },
        });
        const completedOrders = await prisma_1.default.order.count({
            where: { userId: user.id, status: "DONE" },
        });
        res.json({ ...user, stats: { totalOrders, activeOrders, completedOrders } });
    }
    catch (err) {
        console.error("GET /profile error:", err?.message || err);
        res.status(500).json({ message: "Профайл татахад алдаа гарлаа" });
    }
});
/* ════════════════════════════════════════════════════
   PUT /profile — миний профайл шинэчлэх
═══════════════════════════════════════════════════════ */
router.put("/", auth_1.auth, async (req, res) => {
    const { name, phone, companyName, address } = req.body;
    try {
        const updated = await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: {
                ...(name !== undefined && { name: String(name).trim() || null }),
                ...(phone !== undefined && { phone: String(phone).trim() || null }),
                ...(companyName !== undefined && { companyName: String(companyName).trim() || null }),
                ...(address !== undefined && { address: String(address).trim() || null }),
            },
            select: {
                id: true, email: true, name: true, phone: true,
                companyName: true, address: true, role: true,
            },
        });
        res.json(updated);
    }
    catch (err) {
        console.error("PUT /profile error:", err?.message || err);
        res.status(500).json({ message: "Профайл шинэчлэхэд алдаа гарлаа" });
    }
});
/* ════════════════════════════════════════════════════
   PUT /profile/password — нууц үг солих
═══════════════════════════════════════════════════════ */
router.put("/password", auth_1.auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const bcrypt = require("bcrypt");
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Хуучин болон шинэ нууц үг шаардлагатай" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ message: "Шинэ нууц үг 6+ тэмдэгт байх ёстой" });
    }
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid)
            return res.status(401).json({ message: "Хуучин нууц үг буруу байна" });
        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { password: hashed },
        });
        res.json({ message: "Нууц үг амжилттай шинэчлэгдлээ" });
    }
    catch (err) {
        console.error("PUT /profile/password error:", err?.message || err);
        res.status(500).json({ message: "Нууц үг шинэчлэхэд алдаа гарлаа" });
    }
});
/* ════════════════════════════════════════════════════
   GET /profile/saved — Хадгалсан захиалгын загварууд
═══════════════════════════════════════════════════════ */
router.get("/saved", auth_1.auth, async (req, res) => {
    try {
        const list = await prisma_1.default.savedOrderTemplate.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: "desc" },
        });
        res.json(list);
    }
    catch (err) {
        console.error("GET /profile/saved error:", err?.message || err);
        res.status(500).json({ message: "Хадгалсан захиалгуудыг татахад алдаа гарлаа" });
    }
});
/* POST /profile/saved — Шинэ хадгалсан захиалга нэмэх */
router.post("/saved", auth_1.auth, async (req, res) => {
    const { label, serviceTypeId, zoneId, address, volume, volumeUnit, pitStatus, pitType, notes, lat, lng, } = req.body;
    if (!label || !address || !volume) {
        return res.status(400).json({ message: "label, address, volume заавал шаардлагатай" });
    }
    try {
        const created = await prisma_1.default.savedOrderTemplate.create({
            data: {
                userId: req.user.id,
                label: String(label).trim(),
                serviceTypeId: serviceTypeId ? Number(serviceTypeId) : null,
                zoneId: zoneId ? Number(zoneId) : null,
                address: String(address).trim(),
                volume: Number(volume),
                volumeUnit: String(volumeUnit || "TON"),
                pitStatus: pitStatus || null,
                pitType: pitType || null,
                notes: notes || null,
                lat: lat ?? null,
                lng: lng ?? null,
            },
        });
        res.status(201).json(created);
    }
    catch (err) {
        console.error("POST /profile/saved error:", err?.message || err);
        res.status(500).json({ message: "Хадгалахад алдаа гарлаа" });
    }
});
/* DELETE /profile/saved/:id */
router.delete("/saved/:id", auth_1.auth, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id))
        return res.status(400).json({ message: "Буруу ID" });
    try {
        // Зөвхөн өөрийн template-ийг устгана
        const tmpl = await prisma_1.default.savedOrderTemplate.findUnique({ where: { id } });
        if (!tmpl)
            return res.status(404).json({ message: "Олдсонгүй" });
        if (tmpl.userId !== req.user.id)
            return res.status(403).json({ message: "Эрхгүй" });
        await prisma_1.default.savedOrderTemplate.delete({ where: { id } });
        res.json({ message: "Устгагдлаа" });
    }
    catch (err) {
        console.error("DELETE /profile/saved/:id error:", err?.message || err);
        res.status(500).json({ message: "Устгахад алдаа гарлаа" });
    }
});
exports.default = router;
