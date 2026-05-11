"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const orders_1 = __importDefault(require("./routes/orders"));
const admin_1 = __importDefault(require("./routes/admin"));
const payment_1 = __importDefault(require("./routes/payment"));
const meta_1 = __importDefault(require("./routes/meta"));
const pricing_1 = __importDefault(require("./routes/pricing"));
const profile_1 = __importDefault(require("./routes/profile"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
/* ──────────────────────────────────────────────
   ВАЖНО: Frontend нь `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
   гэж тохируулсан тул бүх роут дээр `/api` prefix байх ёстой.
────────────────────────────────────────────── */
app.use("/api/auth", auth_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/admin", admin_1.default);
app.use("/api/payment", payment_1.default);
app.use("/api/meta", meta_1.default);
app.use("/api/pricing", pricing_1.default);
app.use("/api/profile", profile_1.default);
// ── Хуучин код-той нийцтэй байх ──
app.use("/auth", auth_1.default);
app.use("/orders", orders_1.default);
app.use("/admin", admin_1.default);
app.use("/payment", payment_1.default);
app.use("/meta", meta_1.default);
app.use("/pricing", pricing_1.default);
app.use("/profile", profile_1.default);
app.get("/", (_req, res) => res.json({ message: "✅ API Running" }));
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`API endpoints mounted at /api/* (e.g. POST /api/auth/login)`);
});
