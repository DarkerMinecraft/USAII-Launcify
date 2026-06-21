import { Router } from "express";
import { Prisma } from "../../generated/prisma/client";
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
      update: { picture },
      create: { auth0Id, email, name, picture, provider },
    });

    return res.json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[sync] Prisma error:", err.code, err.meta, err.message);
      return res.status(500).json({
        error: "db_error",
        code: err.code,
        meta: err.meta,
        message: err.message,
      });
    }
    throw err;
  }
});

export default router;
