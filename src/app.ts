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

// CORS тохиргоо - frontend URL-уудыг зөвшөөрөх
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://urgujikh-house.vercel.app",
      // Хэрэв custom domain байгаа бол энд нэмнэ
    ],
    credentials: true,
  })
);

app.use(express.json());

// API routes - /api prefix
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/profile", profileRoutes);

// Хуучин код-той нийцтэй байх (prefix-гүй)
app.use("/auth", authRoutes);
app.use("/orders", orderRoutes);
app.use("/admin", adminRoutes);
app.use("/payment", paymentRoutes);
app.use("/meta", metaRoutes);
app.use("/pricing", pricingRoutes);
app.use("/profile", profileRoutes);

// Health check
app.get("/", (_req, res) => res.json({ message: "✅ API Running" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

export default app;