import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/require-user";
import {
  AgentRole,
  NodeStatus,
  SessionStatus,
  Prisma,
} from "../../generated/prisma/client";
import advisorRouter from "../advisor";

const router = Router();

router.use("/:id/advisor", advisorRouter);

const VALID_AGENT_ROLES = new Set(Object.values(AgentRole));
const VALID_NODE_STATUSES = new Set(Object.values(NodeStatus));
const VALID_SESSION_STATUSES = new Set(Object.values(SessionStatus));

const AssumptionInputSchema = z.object({
  claim: z.string().min(1),
  status: z.enum(["VALIDATED", "UNVALIDATED", "NEEDS_INFO"]),
  explanation: z.string().min(1),
  agentSource: z.enum(["SKEPTIC", "STRATEGIST", "OPERATOR"]),
  howToTest: z.string().optional(),
  remediation: z.record(z.string(), z.unknown()).nullable().optional(),
});

const RemediationSchema = z.object({
  action: z.enum(["VALIDATE", "MODIFY", "REMOVE"]),
  howTested: z.string(),
  whatFound: z.string(),
  resolvedAt: z.string(),
});

const AssumptionUpdateSchema = z.object({
  status: z.enum(["VALIDATED", "UNVALIDATED", "NEEDS_INFO"]).optional(),
  claim: z.string().min(1).optional(),
  howToTest: z.string().optional(),
  remediation: RemediationSchema.nullable().optional(),
});

// POST /v1/sessions
router.post("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { ideaSummary, questionnaireResponses } = req.body;

  if (typeof ideaSummary !== "string" || !ideaSummary.trim()) {
    return res
      .status(400)
      .json({ error: "ideaSummary must be a non-empty string" });
  }
  if (!Array.isArray(questionnaireResponses)) {
    return res
      .status(400)
      .json({ error: "questionnaireResponses must be an array" });
  }

  try {
    const session = await prisma.warRoomSession.create({
      data: {
        userId: user.id,
        ideaSummary: ideaSummary.trim(),
        questionnaireResponses,
      },
      select: { id: true, ideaSummary: true, status: true, createdAt: true },
    });
    return res.status(201).json(session);
  } catch (err) {
    console.error("[sessions POST]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// GET /v1/sessions
router.get("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const sessions = await prisma.warRoomSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, ideaSummary: true, status: true, createdAt: true, updatedAt: true },
    });
    return res.json(sessions);
  } catch (err) {
    console.error("[sessions LIST]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// GET /v1/sessions/:id
router.get("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const session = await prisma.warRoomSession.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: {
        transcript: { orderBy: { createdAt: "asc" } },
        assumptions: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) return res.status(404).json({ error: "Session not found" });
    return res.json(session);
  } catch (err) {
    console.error("[sessions GET]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// PATCH /v1/sessions/:id
router.patch("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { id } = req.params;
  const {
    canvas,
    status,
    messages,
    assumptions,
    outreachDraft,
    executiveSummary,
    validationRoadmap,
    marketResearch,
  } = req.body;

  // Validate status enum
  if (status !== undefined && !VALID_SESSION_STATUSES.has(status)) {
    return res.status(400).json({
      error: `status must be one of: ${[...VALID_SESSION_STATUSES].join(", ")}`,
    });
  }

  // Validate messages array
  if (messages !== undefined) {
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }
    for (const m of messages) {
      if (!VALID_AGENT_ROLES.has(m?.agent)) {
        return res.status(400).json({
          error: `message.agent must be one of: ${[...VALID_AGENT_ROLES].join(", ")}`,
        });
      }
      if (typeof m.round !== "number" || !Number.isInteger(m.round)) {
        return res.status(400).json({ error: "message.round must be an integer" });
      }
      if (typeof m.content !== "string" || !m.content.trim()) {
        return res.status(400).json({ error: "message.content must be a non-empty string" });
      }
    }
  }

  // Validate assumptions array using Zod
  if (assumptions !== undefined) {
    if (!Array.isArray(assumptions)) {
      return res.status(400).json({ error: "assumptions must be an array" });
    }
    const parsed = z.array(AssumptionInputSchema).safeParse(assumptions);
    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid assumption shape",
        details: parsed.error.flatten().fieldErrors,
      });
    }
  }

  // Validate launchpad fields — they must be plain objects if provided
  for (const [key, val] of [
    ["outreachDraft", outreachDraft],
    ["executiveSummary", executiveSummary],
    ["validationRoadmap", validationRoadmap],
    ["marketResearch", marketResearch],
  ] as const) {
    if (val !== undefined && (typeof val !== "object" || Array.isArray(val) || val === null)) {
      return res.status(400).json({ error: `${key} must be a JSON object` });
    }
  }

  // Ownership check
  let session;
  try {
    session = await prisma.warRoomSession.findFirst({
      where: { id, userId: user.id },
    });
  } catch (err) {
    console.error("[sessions PATCH lookup]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
  if (!session) return res.status(404).json({ error: "Session not found" });

  try {
    await prisma.$transaction(async (tx) => {
      // Update session scalar + canvas + launchpad fields
      await tx.warRoomSession.update({
        where: { id },
        data: {
          ...(canvas !== undefined && { canvas }),
          ...(status !== undefined && { status }),
          ...(outreachDraft !== undefined && { outreachDraft }),
          ...(executiveSummary !== undefined && { executiveSummary }),
          ...(validationRoadmap !== undefined && { validationRoadmap }),
          ...(marketResearch !== undefined && { marketResearch }),
        },
      });

      // Bulk-write debate messages (idempotent via unique constraint)
      if (messages?.length) {
        await tx.debateMessage.createMany({
          data: messages.map((m: { agent: AgentRole; round: number; content: string }) => ({
            sessionId: id,
            agent: m.agent,
            round: m.round,
            content: m.content.trim(),
          })),
          skipDuplicates: true,
        });
      }

      // Delete-then-recreate assumption nodes (idempotent)
      if (assumptions?.length) {
        await tx.assumptionNode.deleteMany({ where: { sessionId: id } });
        await tx.assumptionNode.createMany({
          data: assumptions.map((a: {
            claim: string;
            status: NodeStatus;
            explanation: string;
            agentSource: AgentRole;
            howToTest?: string;
            remediation?: object;
          }) => ({
            sessionId: id,
            claim: a.claim,
            status: a.status,
            explanation: a.explanation,
            agentSource: a.agentSource,
            howToTest: a.howToTest ?? null,
            remediation: a.remediation ?? null,
          })),
        });
      }
    });

    const updated = await prisma.warRoomSession.findFirst({
      where: { id, userId: user.id },
      include: {
        transcript: { orderBy: { createdAt: "asc" } },
        assumptions: { orderBy: { createdAt: "asc" } },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("[sessions PATCH]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// PATCH /v1/sessions/:id/assumptions/:nodeId
router.patch("/:id/assumptions/:nodeId", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { id, nodeId } = req.params;

  // Validate the update payload
  const parsed = AssumptionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid assumption update",
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const update = parsed.data;

  // Check ownership — verify session belongs to user
  try {
    const session = await prisma.warRoomSession.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Check assumption belongs to session
    const node = await prisma.assumptionNode.findFirst({
      where: { id: nodeId, sessionId: id },
    });
    if (!node) return res.status(404).json({ error: "Assumption not found" });

    const updated = await prisma.assumptionNode.update({
      where: { id: nodeId },
      data: {
        ...(update.status !== undefined && { status: update.status }),
        ...(update.claim !== undefined && { claim: update.claim }),
        ...(update.howToTest !== undefined && { howToTest: update.howToTest }),
        ...(update.remediation !== undefined && {
          remediation: update.remediation === null ? Prisma.JsonNull : update.remediation,
        }),
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("[assumptions PATCH]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// DELETE /v1/sessions/:id
router.delete("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const session = await prisma.warRoomSession.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    await prisma.warRoomSession.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error("[sessions DELETE]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

export default router;
