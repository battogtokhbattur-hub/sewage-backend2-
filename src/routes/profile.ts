import { Router } from "express";
import prisma from "../prisma";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

/* ════════════════════════════════════════════════════
   GET /profile — миний профайл
═══════════════════════════════════════════════════════ */
router.get("/", auth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id: true, email: true, name: true, phone: true,
        companyName: true, address: true, role: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });

    // Хэрэглэгчийн statistics нэмж буцаах
    const totalOrders = await prisma.order.count({ where: { userId: user.id } });
    const activeOrders = await prisma.order.count({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "AWAITING_PAYMENT"] },
      },
    });
    const completedOrders = await prisma.order.count({
      where: { userId: user.id, status: "DONE" },
    });

    res.json({ ...user, stats: { totalOrders, activeOrders, completedOrders } });
  } catch (err: any) {
    console.error("GET /profile error:", err?.message || err);
    res.status(500).json({ message: "Профайл татахад алдаа гарлаа" });
  }
});

/* ════════════════════════════════════════════════════
   PUT /profile — миний профайл шинэчлэх
═══════════════════════════════════════════════════════ */
router.put("/", auth, async (req: AuthRequest, res) => {
  const { name, phone, companyName, address } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name        !== undefined && { name:        String(name).trim()        || null }),
        ...(phone       !== undefined && { phone:       String(phone).trim()       || null }),
        ...(companyName !== undefined && { companyName: String(companyName).trim() || null }),
        ...(address     !== undefined && { address:     String(address).trim()     || null }),
      },
      select: {
        id: true, email: true, name: true, phone: true,
        companyName: true, address: true, role: true,
      },
    });
    res.json(updated);
  } catch (err: any) {
    console.error("PUT /profile error:", err?.message || err);
    res.status(500).json({ message: "Профайл шинэчлэхэд алдаа гарлаа" });
  }
});

/* ════════════════════════════════════════════════════
   PUT /profile/password — нууц үг солих
═══════════════════════════════════════════════════════ */
router.put("/password", auth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  const bcrypt = require("bcrypt");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Хуучин болон шинэ нууц үг шаардлагатай" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ message: "Шинэ нууц үг 6+ тэмдэгт байх ёстой" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: "Хуучин нууц үг буруу байна" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data:  { password: hashed },
    });

    res.json({ message: "Нууц үг амжилттай шинэчлэгдлээ" });
  } catch (err: any) {
    console.error("PUT /profile/password error:", err?.message || err);
    res.status(500).json({ message: "Нууц үг шинэчлэхэд алдаа гарлаа" });
  }
});

/* ════════════════════════════════════════════════════
   GET /profile/saved — Хадгалсан захиалгын загварууд
═══════════════════════════════════════════════════════ */
router.get("/saved", auth, async (req: AuthRequest, res) => {
  try {
    const list = await prisma.savedOrderTemplate.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err: any) {
    console.error("GET /profile/saved error:", err?.message || err);
    res.status(500).json({ message: "Хадгалсан захиалгуудыг татахад алдаа гарлаа" });
  }
});

/* POST /profile/saved — Шинэ хадгалсан захиалга нэмэх */
router.post("/saved", auth, async (req: AuthRequest, res) => {
  const {
    label, serviceTypeId, zoneId, address, volume, volumeUnit,
    pitStatus, pitType, notes, lat, lng,
  } = req.body;

  if (!label || !address || !volume) {
    return res.status(400).json({ message: "label, address, volume заавал шаардлагатай" });
  }

  try {
    const created = await prisma.savedOrderTemplate.create({
      data: {
        userId:        req.user.id,
        label:         String(label).trim(),
        serviceTypeId: serviceTypeId ? Number(serviceTypeId) : null,
        zoneId:        zoneId ? Number(zoneId) : null,
        address:       String(address).trim(),
        volume:        Number(volume),
        volumeUnit:    String(volumeUnit || "TON"),
        pitStatus:     pitStatus || null,
        pitType:       pitType   || null,
        notes:         notes     || null,
        lat:           lat ?? null,
        lng:           lng ?? null,
      },
    });
    res.status(201).json(created);
  } catch (err: any) {
    console.error("POST /profile/saved error:", err?.message || err);
    res.status(500).json({ message: "Хадгалахад алдаа гарлаа" });
  }
});

/* DELETE /profile/saved/:id */
router.delete("/saved/:id", auth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "Буруу ID" });

  try {
    // Зөвхөн өөрийн template-ийг устгана
    const tmpl = await prisma.savedOrderTemplate.findUnique({ where: { id } });
    if (!tmpl)                   return res.status(404).json({ message: "Олдсонгүй" });
    if (tmpl.userId !== req.user.id) return res.status(403).json({ message: "Эрхгүй" });

    await prisma.savedOrderTemplate.delete({ where: { id } });
    res.json({ message: "Устгагдлаа" });
  } catch (err: any) {
    console.error("DELETE /profile/saved/:id error:", err?.message || err);
    res.status(500).json({ message: "Устгахад алдаа гарлаа" });
  }
});

export default router;
