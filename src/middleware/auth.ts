import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Нэвтрэх токен байхгүй" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Defensive check — token-д хүчинтэй id байгаа эсэхийг шалгана
    if (!decoded || typeof decoded.id !== "number") {
      console.error("[auth] Invalid token payload:", decoded);
      return res.status(401).json({ message: "Token-д буруу мэдээлэл" });
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    console.error("[auth] JWT verify failed:", err.message);
    return res.status(401).json({ message: "Хүчингүй токен" });
  }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Нэвтрээгүй" });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Зөвхөн админ хандах эрхтэй" });
  }
  next();
};
