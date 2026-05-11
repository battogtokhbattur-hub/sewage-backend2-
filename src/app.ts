import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import pricingRouter from "./routes/pricing";
import orderRouter from "./routes/orders";
import adminRouter from "./routes/admin";
import profileRouter from "./routes/profile";
import metaRouter from "./routes/meta";
import paymentRouter from "./routes/payment";

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/orders", orderRouter);
app.use("/api/admin", adminRouter);
app.use("/api/profile", profileRouter);
app.use("/api/meta", metaRouter);
app.use("/api/payment", paymentRouter);

export default app;
