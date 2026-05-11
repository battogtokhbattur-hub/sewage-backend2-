import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import orderRoutes from "./routes/orders";
import adminRoutes from "./routes/admin";
import paymentRoutes from "./routes/payment";
import metaRoutes from "./routes/meta";
import pricingRoutes from "./routes/pricing";
import profileRoutes from "./routes/profile";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ──────────────────────────────────────────────
   ВАЖНО: Frontend нь `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
   гэж тохируулсан тул бүх роут дээр `/api` prefix байх ёстой.
────────────────────────────────────────────── */
app.use("/api/auth",    authRoutes);
app.use("/api/orders",  orderRoutes);
app.use("/api/admin",   adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/meta",    metaRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/profile", profileRoutes);

// ── Хуучин код-той нийцтэй байх ──
app.use("/auth",    authRoutes);
app.use("/orders",  orderRoutes);
app.use("/admin",   adminRoutes);
app.use("/payment", paymentRoutes);
app.use("/meta",    metaRoutes);
app.use("/pricing", pricingRoutes);
app.use("/profile", profileRoutes);

app.get("/", (_req, res) => res.json({ message: "✅ API Running" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`API endpoints mounted at /api/* (e.g. POST /api/auth/login)`);
});
