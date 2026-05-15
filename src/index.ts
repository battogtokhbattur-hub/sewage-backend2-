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

// CORS тохиргоо - frontend домэйнийг зөвшөөрөх
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://urgujikh-house.vercel.app",
    "https://urgujikh-house-git-main-battogtokhbattur-hubs-projects.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

// API routes
app.use("/api/auth",    authRoutes);
app.use("/api/orders",  orderRoutes);
app.use("/api/admin",   adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/meta",    metaRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/profile", profileRoutes);

// Хуучин кодтой нийцтэй (prefix-гүй)
app.use("/auth",    authRoutes);
app.use("/orders",  orderRoutes);
app.use("/admin",   adminRoutes);
app.use("/payment", paymentRoutes);
app.use("/meta",    metaRoutes);
app.use("/pricing", pricingRoutes);
app.use("/profile", profileRoutes);

// Health check
app.get("/", (_req, res) => res.json({ message: "✅ API Running" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

export default app;