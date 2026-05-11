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

app.use("/api/auth",    authRoutes);
app.use("/api/orders",  orderRoutes);
app.use("/api/admin",   adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/meta",    metaRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/profile", profileRoutes);

app.get("/", (_req, res) => res.json({ message: "✅ API Running" }));

// Local dev-д л ажиллана
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

export default app; // ← энэ нэмэгдлээ