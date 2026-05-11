import { Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middleware/auth";

export const getAllUsersWithOrders = async (
  req: AuthRequest,
  res: Response
) => {
  const users = await prisma.user.findMany({
    include: {
      orders: true,
    },
  });

  res.json(users);
};

export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response
) => {
  const { id } = req.params;
  const { status } = req.body;

  const updated = await prisma.order.update({
    where: { id: Number(id) },
    data: { status },
  });

  res.json(updated);
};

export const deleteOrder = async (
  req: AuthRequest,
  res: Response
) => {
  const { id } = req.params;

  await prisma.order.delete({
    where: { id: Number(id) },
  });

  res.json({ message: "Deleted" });
};
