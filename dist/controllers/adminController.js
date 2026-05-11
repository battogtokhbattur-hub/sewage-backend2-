"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOrder = exports.updateOrderStatus = exports.getAllUsersWithOrders = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getAllUsersWithOrders = async (req, res) => {
    const users = await prisma_1.default.user.findMany({
        include: {
            orders: true,
        },
    });
    res.json(users);
};
exports.getAllUsersWithOrders = getAllUsersWithOrders;
const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma_1.default.order.update({
        where: { id: Number(id) },
        data: { status },
    });
    res.json(updated);
};
exports.updateOrderStatus = updateOrderStatus;
const deleteOrder = async (req, res) => {
    const { id } = req.params;
    await prisma_1.default.order.delete({
        where: { id: Number(id) },
    });
    res.json({ message: "Deleted" });
};
exports.deleteOrder = deleteOrder;
