import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { User } from "../generated/prisma/client";

export const requireUser = async (req: Request, res: Response): Promise<User | null> => {
  const sub = req.auth?.payload?.sub;
  if (!sub) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const user = await prisma.user.findUnique({ where: { auth0Id: sub } });
  if (!user) {
    res.status(404).json({
      error: "user_not_found",
      message: "Call GET /v1/auth/sync first to register your account.",
    });
    return null;
  }

  return user;
};
