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

  const email = payload.email as string | undefined;
  if (!email) {
    return res.status(400).json({
      error: "missing_email",
      message: "Auth0 token does not include an email claim. Add email as a custom claim in your Auth0 Action.",
    });
  }

  const name = payload.name as string | undefined;
  const picture = payload.picture as string | undefined;

  const provider = auth0Id.startsWith("google-oauth2") ? "google" : "auth0";

  try {
    const user = await prisma.user.upsert({
      where: { auth0Id },
      update: { email, name, picture },
      create: { auth0Id, email, name, picture, provider },
    });
    return res.json(user);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; meta?: unknown };
    console.error("[sync] Prisma error:", err.code, err.message, err.meta);
    return res.status(500).json({
      error: "db_error",
      code: err.code,
      message: err.message,
    });
  }
});

export default router;
