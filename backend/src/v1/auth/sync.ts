import { Router } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

router.get("/sync", async (req, res) => {
  const payload = req.auth?.payload;

  if (!payload?.sub) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const auth0Id = payload.sub;

  const email = payload.email as string;
  const name = payload.name as string;
  const picture = payload.picture as string;

  const provider = auth0Id.startsWith("google-oauth2") ? "google" : "auth0";

  const user = await prisma.user.upsert({
    where: {
      auth0Id,
    },
    update: {
      email,
      name,
      picture,
    },
    create: {
      auth0Id,
      email,
      name,
      picture,
      provider,
    },
  });

  return res.json(user);
});

export default router;
