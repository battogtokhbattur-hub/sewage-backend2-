"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedLookups = seedLookups;
const prisma_1 = __importDefault(require("../prisma"));
async function seedLookups() {
    // Service Types
    const serviceTypes = [
        { code: "BOHIR_US", name: "Бохир ус тээвэр" },
        { code: "LAG", name: "Лаг соруулах" },
        { code: "SEPTIK", name: "Септик соруулах" },
        { code: "UGALGA", name: "Угаалга" },
    ];
    for (const st of serviceTypes) {
        await prisma_1.default.serviceType.upsert({
            where: { code: st.code },
            update: { name: st.name, isActive: true },
            create: st,
        });
    }
    // Zones
    const zones = [
        { name: "БЗД", basePrice: 30000, perTonPrice: 5000, perM3Price: 5000, perKmPrice: 0 },
        { name: "СБД", basePrice: 35000, perTonPrice: 5500, perM3Price: 5500, perKmPrice: 0 },
        { name: "ХУД", basePrice: 40000, perTonPrice: 6000, perM3Price: 6000, perKmPrice: 0 },
    ];
    for (const z of zones) {
        await prisma_1.default.zone.upsert({
            where: { name: z.name },
            update: z,
            create: z,
        });
    }
    // Add-ons
    const addOns = [
        { code: "URGENT", name: "Яаралтай", priceType: "PERCENT", priceValue: 20 },
        { code: "NIGHT", name: "Шөнө/ажлын бус цаг", priceType: "PERCENT", priceValue: 15 },
        { code: "MULTI_POINT", name: "Олон цэг", priceType: "FIXED", priceValue: 10000 },
    ];
    for (const a of addOns) {
        await prisma_1.default.addOnService.upsert({
            where: { code: a.code },
            update: { ...a, isActive: true },
            create: a,
        });
    }
    // Slots: ирэх 7 өдөр
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        d.setHours(0, 0, 0, 0);
        const slots = [
            { startTime: "09:00", endTime: "11:00" },
            { startTime: "11:00", endTime: "13:00" },
            { startTime: "14:00", endTime: "16:00" },
        ];
        for (const s of slots) {
            await prisma_1.default.timeSlot.upsert({
                where: { date_startTime_endTime: { date: d, startTime: s.startTime, endTime: s.endTime } },
                update: {},
                create: { date: d, startTime: s.startTime, endTime: s.endTime, capacity: 3 },
            });
        }
    }
}
