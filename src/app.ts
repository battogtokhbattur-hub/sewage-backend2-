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

app.set("trust proxy", 1);

const STATIC_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://urgujikh-house.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (STATIC_ORIGINS.includes(origin)) return callback(null, true);
      if (/^https:\/\/urgujikh-house.*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      console.warn("CORS blocked:", origin);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "2mb" }));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/profile", profileRoutes);

// Prefix-гүй routes
app.use("/auth", authRoutes);
app.use("/orders", orderRoutes);
app.use("/admin", adminRoutes);
app.use("/payment", paymentRoutes);
app.use("/meta", metaRoutes);
app.use("/pricing", pricingRoutes);
app.use("/profile", profileRoutes);

// Health checks
app.get("/", (_req, res) => res.json({ message: "✅ API Running" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// EMAIL TEST ENDPOINT
app.get("/api/test-email", async (_req, res) => {
  const envInfo = {
    adminEmail: process.env.ADMIN_EMAIL || "NOT SET",
    smtpUser: process.env.SMTP_USER || "NOT SET",
    smtpHost: process.env.SMTP_HOST || "NOT SET",
    smtpPort: process.env.SMTP_PORT || "NOT SET",
    hasSmtpPass: !!process.env.SMTP_PASS,
    smtpPassLength: process.env.SMTP_PASS?.length || 0,
    appUrl: process.env.APP_URL || "NOT SET",
  };

  try {
    const { sendOrderNotification } = await import("./services/emailService");

    await sendOrderNotification({
      id: 999,
      serviceType: "🧪 Тест үйлчилгээ",
      district: "Тест дүүрэг",
      address: "Тест хаяг — энэ нь тест email",
      volume: 5,
      volumeUnit: "TON",
      date: new Date().toISOString().split("T")[0],
      timeSlot: "09-11",
      basePrice: 100000,
      addOns: [],
      totalPrice: 100000,
      customerName: "Тест хэрэглэгч",
      customerEmail: "test@example.com",
      customerPhone: "99999999",
    });

    res.json({
      success: true,
      message: "✅ Test email амжилттай илгээгдлээ!",
      sentTo: envInfo.adminEmail,
      env: envInfo,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      errorCode: err.code,
      errorCommand: err.command,
      env: envInfo,
    });
  }
});

// Глобал error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Серверийн алдаа",
  });
});

export default app;