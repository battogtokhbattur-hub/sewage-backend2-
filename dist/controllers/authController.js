"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.me = exports.login = exports.register = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const emailService_1 = require("../services/emailService");
// REGISTER
const register = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: "Имэйл болон нууц үг оруулна уу" });
    // Имэйл формат шалгах
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Имэйл буруу форматтай байна" });
    }
    // Нууц үгийн урт шалгах
    if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "Нууц үг 6+ тэмдэгт байх ёстой" });
    }
    const existing = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing)
        return res.status(409).json({ message: "Имэйл бүртгэлтэй байна" });
    const hashed = await bcrypt_1.default.hash(password, 10);
    // ⚠️ ХЭЗЭЭ Ч req.body.role АШИГЛАХГҮЙ — хатуу "USER" болгож үүсгэнэ
    const user = await prisma_1.default.user.create({
        data: { email: email.toLowerCase(), password: hashed, role: "USER" },
    });
    res.json({ id: user.id, email: user.email, role: user.role });
};
exports.register = register;
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const BLOCK_MS = 15 * 60 * 1000; // 15 минут
function getClientKey(req, email) {
    // Express дотор IP нь req.ip (trust proxy зөв тохируулсан тохиолдолд)
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.socket?.remoteAddress
        || "unknown";
    return `${ip}:${String(email).toLowerCase()}`;
}
function checkRateLimit(key) {
    const now = Date.now();
    const att = loginAttempts.get(key);
    if (!att)
        return { ok: true };
    // Block-той эсэхийг шалгах
    if (att.blockedUntil && att.blockedUntil > now) {
        return { ok: false, retryAfterSec: Math.ceil((att.blockedUntil - now) / 1000) };
    }
    // Window гарвал тоог reset
    if (now - att.firstAttempt > WINDOW_MS) {
        loginAttempts.delete(key);
    }
    return { ok: true };
}
function recordFailedAttempt(key) {
    const now = Date.now();
    const att = loginAttempts.get(key);
    if (!att) {
        loginAttempts.set(key, { count: 1, firstAttempt: now });
        return;
    }
    att.count += 1;
    if (att.count >= MAX_ATTEMPTS) {
        att.blockedUntil = now + BLOCK_MS;
    }
    loginAttempts.set(key, att);
}
function clearAttempts(key) {
    loginAttempts.delete(key);
}
// LOGIN
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Имэйл болон нууц үг оруулна уу" });
    }
    // Rate limit шалгах
    const key = getClientKey(req, email);
    const rl = checkRateLimit(key);
    if (!rl.ok) {
        const min = Math.ceil((rl.retryAfterSec ?? 0) / 60);
        return res.status(429).json({
            message: `Хэт олон удаа буруу оролдсон. ${min} минутын дараа дахин оролдоно уу.`,
        });
    }
    const user = await prisma_1.default.user.findUnique({
        where: { email: String(email).toLowerCase() },
    });
    if (!user) {
        recordFailedAttempt(key);
        return res.status(401).json({ message: "Имэйл эсвэл нууц үг буруу" });
    }
    const valid = await bcrypt_1.default.compare(password, user.password);
    if (!valid) {
        recordFailedAttempt(key);
        return res.status(401).json({ message: "Имэйл эсвэл нууц үг буруу" });
    }
    // Амжилттай → counter цэвэрлэнэ
    clearAttempts(key);
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, role: user.role });
};
exports.login = login;
// GET /auth/me
const me = async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, phone: true, role: true },
    });
    if (!user)
        return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
    res.json(user);
};
exports.me = me;
// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    // Always respond with success to prevent email enumeration
    res.json({ message: "Хэрвээ имэйл бүртгэлтэй бол сэргээх заавар илгээгдэнэ" });
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    if (!user)
        return;
    // Delete any existing tokens for this user
    await prisma_1.default.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma_1.default.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
    });
    const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/auth/reset-password?token=${token}`;
    try {
        await (0, emailService_1.sendPasswordResetEmail)({ to: email, resetUrl });
    }
    catch (err) {
        console.error("[forgotPassword] Email send failed:", err);
    }
};
exports.forgotPassword = forgotPassword;
// RESET PASSWORD
const resetPassword = async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password)
        return res.status(400).json({ message: "Token болон нууц үг шаардлагатай" });
    const record = await prisma_1.default.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date())
        return res.status(400).json({ message: "Token хүчингүй эсвэл хугацаа дууссан" });
    const hashed = await bcrypt_1.default.hash(password, 10);
    await prisma_1.default.user.update({
        where: { id: record.userId },
        data: { password: hashed },
    });
    await prisma_1.default.passwordResetToken.delete({ where: { token } });
    res.json({ message: "Нууц үг амжилттай солигдлоо" });
};
exports.resetPassword = resetPassword;
