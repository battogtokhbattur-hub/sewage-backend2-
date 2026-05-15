"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const router = (0, express_1.Router)();
router.get("/service-types", async (_req, res) => {
    try {
        const data = await prisma_1.default.serviceType.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ message: "Failed to fetch service types" });
    }
});
router.get("/zones", async (_req, res) => {
    try {
        const data = await prisma_1.default.zone.findMany({ orderBy: { id: "asc" } });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ message: "Failed to fetch zones" });
    }
});
router.get("/add-ons", async (_req, res) => {
    try {
        const data = await prisma_1.default.addOnService.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ message: "Failed to fetch add-ons" });
    }
});
router.get("/slots", async (req, res) => {
    try {
        const dateStr = String(req.query.date || "");
        if (!dateStr)
            return res.status(400).json({ message: "date is required (YYYY-MM-DD)" });
        const start = new Date(dateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        const slots = await prisma_1.default.timeSlot.findMany({
            where: { date: { gte: start, lt: end } },
            orderBy: [{ startTime: "asc" }],
        });
        const data = slots.map((s) => ({
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            available: s.bookedCount < s.capacity,
            capacity: s.capacity,
            bookedCount: s.bookedCount,
        }));
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ message: "Failed to fetch slots" });
    }
});
exports.default = router;
