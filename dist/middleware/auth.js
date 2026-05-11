"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOnly = exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Нэвтрэх токен байхгүй" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Defensive check — token-д хүчинтэй id байгаа эсэхийг шалгана
        if (!decoded || typeof decoded.id !== "number") {
            console.error("[auth] Invalid token payload:", decoded);
            return res.status(401).json({ message: "Token-д буруу мэдээлэл" });
        }
        req.user = decoded;
        next();
    }
    catch (err) {
        console.error("[auth] JWT verify failed:", err.message);
        return res.status(401).json({ message: "Хүчингүй токен" });
    }
};
exports.auth = auth;
const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Нэвтрээгүй" });
    }
    if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Зөвхөн админ хандах эрхтэй" });
    }
    next();
};
exports.adminOnly = adminOnly;
