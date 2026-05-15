"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const router = (0, express_1.Router)();
router.post("/calculate", async (req, res) => {
    const { zoneId, volume, volumeUnit, addOnIds = [] } = req.body;
    if (!zoneId || !volume || !volumeUnit) {
        return res.status(400).json({ message: "zoneId, volume, volumeUnit are required" });
    }
    const zone = await prisma_1.default.zone.findUnique({ where: { id: Number(zoneId) } });
    if (!zone)
        return res.status(404).json({ message: "Zone not found" });
    const base = zone.basePrice;
    const volumeCost = volumeUnit === "TON"
        ? Math.round(Number(volume) * zone.perTonPrice)
        : Math.round(Number(volume) * zone.perM3Price);
    const subtotal = base + volumeCost;
    const addOns = await prisma_1.default.addOnService.findMany({
        where: { id: { in: addOnIds.map(Number) }, isActive: true },
    });
    let addOnTotal = 0;
    const addOnBreakdown = addOns.map((a) => {
        const amount = a.priceType === "FIXED" ? a.priceValue : Math.round((subtotal * a.priceValue) / 100);
        addOnTotal += amount;
        return { id: a.id, name: a.name, priceType: a.priceType, priceValue: a.priceValue, amount };
    });
    const total = subtotal + addOnTotal;
    res.json({
        breakdown: { base, volumeCost, subtotal, addOnTotal, total, addOns: addOnBreakdown },
    });
});
exports.default = router;
