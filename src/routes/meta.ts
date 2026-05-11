import { Router } from "express";
import prisma from "../prisma";
import { TimeSlot } from "@prisma/client";

const router = Router();

router.get("/service-types", async (_req, res) => {
  try {
    const data = await prisma.serviceType.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch service types" });
  }
});

router.get("/zones", async (_req, res) => {
  try {
    const data = await prisma.zone.findMany({ orderBy: { id: "asc" } });
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch zones" });
  }
});

router.get("/add-ons", async (_req, res) => {
  try {
    const data = await prisma.addOnService.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch add-ons" });
  }
});

router.get("/slots", async (req, res) => {
  try {
    const dateStr = String(req.query.date || "");
    if (!dateStr) return res.status(400).json({ message: "date is required (YYYY-MM-DD)" });

    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const slots = await prisma.timeSlot.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ startTime: "asc" }],
    });

    const data = slots.map((s: TimeSlot) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      available: s.bookedCount < s.capacity,
      capacity: s.capacity,
      bookedCount: s.bookedCount,
    }));

    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch slots" });
  }
});

export default router;