import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";
import { AgentRole, NodeStatus, SessionStatus } from "../../generated/prisma/client";

const router = Router();

const VALID_AGENT_ROLES = new Set(Object.values(AgentRole));
const VALID_NODE_STATUSES = new Set(Object.values(NodeStatus));
const VALID_SESSION_STATUSES = new Set(Object.values(SessionStatus));

// POST /v1/sessions
router.post("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { ideaSummary, questionnaireResponses } = req.body;

  if (typeof ideaSummary !== "string" || !ideaSummary.trim()) {
    return res.status(400).json({ error: "ideaSummary must be a non-empty string" });
  }
  if (!Array.isArray(questionnaireResponses)) {
    return res.status(400).json({ error: "questionnaireResponses must be an array" });
  }

  const session = await prisma.warRoomSession.create({
    data: { userId: user.id, ideaSummary: ideaSummary.trim(), questionnaireResponses },
    select: { id: true, ideaSummary: true, status: true, createdAt: true },
  });

  return res.status(201).json(session);
});

// GET /v1/sessions/:id
router.get("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const session = await prisma.warRoomSession.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: {
      transcript: { orderBy: { createdAt: "asc" } },
      assumptions: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) return res.status(404).json({ error: "Session not found" });

  return res.json(session);
});

// PATCH /v1/sessions/:id
router.patch("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { id } = req.params;
  const { canvas, status, messages, assumptions } = req.body;

  // Validate enum values and shapes before touching Prisma
  if (status !== undefined && !VALID_SESSION_STATUSES.has(status)) {
    return res.status(400).json({ error: `status must be one of: ${[...VALID_SESSION_STATUSES].join(", ")}` });
  }
  if (messages !== undefined) {
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }
    for (const m of messages) {
      if (!VALID_AGENT_ROLES.has(m?.agent)) {
        return res.status(400).json({ error: `message.agent must be one of: ${[...VALID_AGENT_ROLES].join(", ")}` });
      }
      if (typeof m.round !== "number" || !Number.isInteger(m.round)) {
        return res.status(400).json({ error: "message.round must be an integer" });
      }
      if (typeof m.content !== "string" || !m.content.trim()) {
        return res.status(400).json({ error: "message.content must be a non-empty string" });
      }
    }
  }
  if (assumptions !== undefined) {
    if (!Array.isArray(assumptions)) {
      return res.status(400).json({ error: "assumptions must be an array" });
    }
    for (const a of assumptions) {
      if (!VALID_NODE_STATUSES.has(a?.status)) {
        return res.status(400).json({ error: `assumption.status must be one of: ${[...VALID_NODE_STATUSES].join(", ")}` });
      }
      if (!VALID_AGENT_ROLES.has(a?.agentSource)) {
        return res.status(400).json({ error: `assumption.agentSource must be one of: ${[...VALID_AGENT_ROLES].join(", ")}` });
      }
    }
  }

  const session = await prisma.warRoomSession.findFirst({ where: { id, userId: user.id } });
  if (!session) return res.status(404).json({ error: "Session not found" });

  await prisma.$transaction(async (tx) => {
    await tx.warRoomSession.update({
      where: { id },
      data: {
        ...(canvas !== undefined && { canvas }),
        ...(status !== undefined && { status }),
      },
    });

    if (messages?.length) {
      // skipDuplicates is safe here because @@unique([sessionId, agent, round]) prevents doubles
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

    if (assumptions?.length) {
      // Delete-then-recreate is idempotent: retries produce the same set of nodes
      await tx.assumptionNode.deleteMany({ where: { sessionId: id } });
      await tx.assumptionNode.createMany({
        data: assumptions.map((a: {
          claim: string;
          status: NodeStatus;
          explanation: string;
          agentSource: AgentRole;
          remediation?: object;
        }) => ({
          sessionId: id,
          claim: a.claim,
          status: a.status,
          explanation: a.explanation,
          agentSource: a.agentSource,
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
});

export default router;
