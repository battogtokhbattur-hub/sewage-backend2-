import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: { type: [orderItemSchema], default: [] },

    phone: { type: String, default: "" },
    address: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Completed", "Cancelled"],
      default: "Pending"
    },

    total: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
