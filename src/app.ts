import express from "express";
import cors from "cors";
import pricingRouter from "./routes/pricing";
import orderRouter from "./routes/orders";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/pricing", pricingRouter);
app.use("/orders,", orderRouter);
export default app;
