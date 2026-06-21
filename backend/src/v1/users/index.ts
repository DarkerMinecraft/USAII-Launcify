import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/require-user";

const router = Router();

const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100),
});

router.patch("/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_input",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true, picture: true },
    });
    return res.json(updated);
  } catch (err) {
    console.error("[users PATCH /me]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

export default router;
