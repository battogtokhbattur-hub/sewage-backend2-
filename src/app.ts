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

// Vercel-ийн ард ажиллах үед client IP-г зөв авах
app.set("trust proxy", 1);

// CORS — production домэйн + бүх preview deployment
const STATIC_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://urgujikh-house.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman, curl, server-to-server — origin байхгүй
      if (!origin) return callback(null, true);

      if (STATIC_ORIGINS.includes(origin)) return callback(null, true);

      // Preview deployment: urgujikh-house-*.vercel.app
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

// API routes (/api prefix)
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/profile", profileRoutes);

// Prefix-гүй routes (хуучин код-той нийцтэй)
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

// Глобал error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Серверийн алдаа",
  });
});

export default app;