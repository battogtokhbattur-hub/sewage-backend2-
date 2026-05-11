import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app    = express();
const prisma = new PrismaClient();
const PORT       = process.env.PORT       || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

/* ── Middleware ── */
const auth = async (req: any, res: any, next: any) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      return res.status(401).json({ message: "Нэвтрэх шаардлагатай" });
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET as string);
    next();
  } catch {
    return res.status(401).json({ message: "Token буруу" });
  }
};

const adminOnly = (req: any, res: any, next: any) => {
  if (req.user?.role !== "ADMIN")
    return res.status(403).json({ message: "Админ эрх шаардлагатай" });
  next();
};

/* ── Health ── */
app.get("/", (_req: any, res: any) => res.json({ message: "✅ API Running" }));

/* ════════════════════════════════
   AUTH
════════════════════════════════ */
app.post("/auth/register", async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "Имэйл бүртгэлтэй байна" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await prisma.user.create({
      data: { email, password: hashed, role: "USER" },
    });
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET as string,
      { expiresIn: "7d" }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

app.post("/auth/login", async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Имэйл эсвэл нууц үг буруу" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Имэйл эсвэл нууц үг буруу" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET as string,
      { expiresIn: "7d" }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

/* ════════════════════════════════
   ORDERS
   ⚠️ /orders/my нь /orders/:id-ийн ӨМНӨ байх ёстой
════════════════════════════════ */

// POST /orders — Wizard-аас захиалга үүсгэх
app.post("/orders", auth, async (req: any, res: any) => {
  try {
    const {
      serviceType,  // "BOHIR_US" | "LAG" | "SEPTIK" | "UGALGA"
      district,
      address,
      volume,
      unit,         // "тонн" | "м³"
      date,
      timeSlot,     // "09-11" | "11-13" ...
      extras,       // string[]
      totalPrice,
    } = req.body;

    if (!address) return res.status(400).json({ message: "Хаяг оруулна уу" });

    const order = await prisma.order.create({
      data: {
        userId:      req.user.id,
        // Шинэ энгийн field-үүд
        serviceCode: serviceType ?? "BOHIR_US",
        district:    district    ?? "БЗД",
        unit:        unit        ?? "тонн",
        timeSlot:    timeSlot    ?? "09-11",
        extras:      Array.isArray(extras) ? extras : [],
        totalPrice:  Number(totalPrice) || 0,
        // Одоогийн field-үүд
        address:     String(address),
        volume:      Number(volume) || 5,
        volumeUnit:  unit === "м³" ? "M3" : "TON",
        status:      "PENDING",
        priceTotal:  Number(totalPrice) || 0,
        // date — слот болгон хадгална
        // slotId optional тул орхино
      },
    });

    return res.status(201).json(order);
  } catch (err) {
    console.error("POST /orders:", err);
    res.status(500).json({ message: "Захиалга үүсгэхэд алдаа гарлаа" });
  }
});

// GET /orders/my — Dashboard-д өөрийн захиалгууд
app.get("/orders/my", auth, async (req: any, res: any) => {
  try {
    const orders = await prisma.order.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(orders);
  } catch (err) {
    console.error("GET /orders/my:", err);
    res.status(500).json({ message: "Захиалга татахад алдаа гарлаа" });
  }
});

// GET /orders
app.get("/orders", auth, async (req: any, res: any) => {
  try {
    const orders = await prisma.order.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(orders);
  } catch (err) {
    console.error("GET /orders:", err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

// PUT /orders/:id/cancel
app.put("/orders/:id/cancel", auth, async (req: any, res: any) => {
  try {
    const id    = parseInt(req.params.id);
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!order) return res.status(404).json({ message: "Захиалга олдсонгүй" });
    if (order.status !== "PENDING")
      return res.status(400).json({ message: "Зөвхөн хүлээгдэж буй захиалгыг цуцлах боломжтой" });

    const updated = await prisma.order.update({
      where: { id },
      data:  { status: "CANCELED" },
    });
    return res.json(updated);
  } catch (err) {
    console.error("PUT /orders/:id/cancel:", err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

/* ════════════════════════════════
   ADMIN
════════════════════════════════ */
app.get("/admin/orders", auth, adminOnly, async (_req: any, res: any) => {
  try {
    const orders = await prisma.order.findMany({
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

app.put("/admin/orders/:id", auth, adminOnly, async (req: any, res: any) => {
  try {
    const id         = parseInt(req.params.id);
    const { status } = req.body;
    const order      = await prisma.order.update({
      where:   { id },
      data:    { status },
      include: { user: { select: { id: true, email: true } } },
    });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

app.delete("/admin/orders/:id", auth, adminOnly, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.order.delete({ where: { id } });
    res.json({ message: "Захиалга устгагдлаа" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Серверийн алдаа" });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

export default app;