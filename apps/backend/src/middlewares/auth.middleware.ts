import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.token;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
    id: string;
  };
  if (!decoded) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = { id: user.id };
  next();
};
