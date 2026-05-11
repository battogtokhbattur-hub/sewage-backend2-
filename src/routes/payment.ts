import { Router } from "express";
import prisma from "../prisma";
import { auth, AuthRequest } from "../middleware/auth";
import { sendAdminPaymentNotice } from "../services/statusEmails";

const router = Router();

const ORDER_INCLUDE = {
  user:        { select: { id: true, email: true, name: true, phone: true } },
  serviceType: true,
  zone:        true,
  slot:        true,
  addOns:      { include: { addOn: true } },
} as const;

/* ════════════════════════════════════════════════════
   POST /payment/:orderId/mark-paid
   Хэрэглэгч өөрөө "Төлбөр шилжүүлсэн" гэж тэмдэглэх
   (Admin дараа нь баталгаажуулах хэрэгтэй)
════════════════════════════════════════════════════ */
router.post("/:orderId/mark-paid", auth, async (req: AuthRequest, res) => {
  const orderId = Number(req.params.orderId);
  const { transactionRef, note } = req.body;

  if (isNaN(orderId)) return res.status(400).json({ message: "Буруу ID" });

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) return res.status(404).json({ message: "Захиалга олдсонгүй" });

    // Зөвхөн өөрийн захиалгад үйлдэх боломжтой
    if (order.userId !== req.user!.id && req.user!.role !== "ADMIN")
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

    const updated = await prisma.order.update({
      where: { id: orderId },
      data:  { notes: updatedNote },
      include: ORDER_INCLUDE,
    });

    // Админ руу мэдэгдэх имэйл (fire-and-forget)
    setImmediate(async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) return;
        await sendAdminPaymentNotice({
          adminEmail,
          orderId:       updated.id,
          customerName:  (updated as any).user?.name  || updated.customerName  || "—",
          customerEmail: (updated as any).user?.email || "—",
          customerPhone: (updated as any).user?.phone || updated.customerPhone || "—",
          address:       updated.address,
          serviceType:   (updated as any).serviceType?.name || "—",
          priceTotal:    Number(updated.priceTotal || (updated as any).totalPrice || 0),
          transactionRef,
          userNote:      note,
          dashboardUrl:  `${process.env.ADMIN_DASHBOARD_URL ?? "http://localhost:3000"}/admin`,
        });
      } catch (err) {
        console.error(`[Payment] Admin email failed #${updated.id}:`, err);
      }
    });

    res.json({
      message: "Төлсөн гэж амжилттай тэмдэглэлээ. Админ удахгүй баталгаажуулах болно.",
      order:   updated,
    });
  } catch (err) {
    console.error("POST /payment/mark-paid error:", err);
    res.status(500).json({ message: "Тэмдэглэхэд алдаа гарлаа" });
  }
});

export default router;
