import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/require-user";
import { uploadToS3, deleteFromS3 } from "../../lib/s3";

// mergeParams so req.params.id (session id) is accessible from parent router
const router = Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MessageSchema = z.object({
  role: z.enum(["USER", "ASSISTANT"]),
  content: z.string().min(1),
});

// ── helpers ──────────────────────────────────────────────────────────────────

const chunkText = (text: string, size = 500, overlap = 50): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
  }
  return chunks;
};

const ownsSession = async (sessionId: string, userId: string) => {
  const s = await prisma.warRoomSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  return s !== null;
};

// ── GET /v1/sessions/:id/advisor ─────────────────────────────────────────────

router.get("/", async (req: Request<{ id: string }>, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const [messages, rawDocs] = await Promise.all([
      prisma.advisorMessage.findMany({
        where: { sessionId: req.params.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sessionDocument.findMany({
        where: { sessionId: req.params.id },
        include: { _count: { select: { chunks: true } } },
        orderBy: { uploadedAt: "desc" },
      }),
    ]);

    return res.json({
      messages,
      documents: rawDocs.map((d) => ({
        id: d.id,
        filename: d.filename,
        uploadedAt: d.uploadedAt,
        chunkCount: d._count.chunks,
      })),
    });
  } catch (err) {
    console.error("[advisor GET]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// ── POST /v1/sessions/:id/advisor/messages ────────────────────────────────────

router.post("/messages", async (req: Request<{ id: string }>, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const parsed = z.array(MessageSchema).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten().fieldErrors });
    }

    await prisma.advisorMessage.createMany({
      data: parsed.data.map((m) => ({ sessionId: req.params.id, role: m.role, content: m.content })),
    });

    return res.status(201).json({ saved: parsed.data.length });
  } catch (err) {
    console.error("[advisor POST messages]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// ── POST /v1/sessions/:id/advisor/documents ───────────────────────────────────

router.post("/documents", upload.single("file"), async (req: Request<{ id: string }>, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  if (!req.file) return res.status(400).json({ error: "file_required" });
  const { mimetype, originalname, buffer } = req.file;

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    // Create DB record first to get the ID for the S3 key
    const doc = await prisma.sessionDocument.create({
      data: { sessionId: req.params.id, filename: originalname, s3Key: "" },
    });

    const s3Key = `sessions/${req.params.id}/docs/${doc.id}/${originalname}`;
    await prisma.sessionDocument.update({ where: { id: doc.id }, data: { s3Key } });

    // Upload raw file to S3
    await uploadToS3(s3Key, buffer, mimetype);

    // Extract text
    let text = "";
    if (mimetype === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      text = result.text;
      await parser.destroy();
    } else {
      text = buffer.toString("utf-8");
    }

    if (!text.trim()) {
      await prisma.sessionDocument.delete({ where: { id: doc.id } });
      return res.status(422).json({ error: "no_text_extracted" });
    }

    // Chunk and store (embedding added in Task 10)
    const chunks = chunkText(text);
    await prisma.documentChunk.createMany({
      data: chunks.map((content, chunkIndex) => ({ documentId: doc.id, content, chunkIndex })),
    });

    // Return chunks so the frontend can embed them (Gemini must be called from Next.js)
    return res.status(201).json({
      documentId: doc.id,
      chunkCount: chunks.length,
      filename: originalname,
      chunks,
    });
  } catch (err) {
    console.error("[advisor POST documents]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// ── DELETE /v1/sessions/:id/advisor/documents/:docId ─────────────────────────

router.delete("/documents/:docId", async (req: Request<{ id: string; docId: string }>, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const doc = await prisma.sessionDocument.findFirst({
      where: { id: req.params.docId, sessionId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: "document_not_found" });

    if (doc.s3Key) await deleteFromS3(doc.s3Key);
    await prisma.sessionDocument.delete({ where: { id: doc.id } });

    return res.status(204).send();
  } catch (err) {
    console.error("[advisor DELETE document]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// ── POST /v1/sessions/:id/advisor/search ─────────────────────────────────────
// Accepts { embedding: number[] (768 floats) }, returns top-3 chunks by cosine similarity

router.post("/search", async (req: Request<{ id: string }>, res: Response) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { embedding } = req.body as { embedding: unknown };
  if (!Array.isArray(embedding) || embedding.length !== 768) {
    return res.status(400).json({ error: "embedding must be a 768-element number array" });
  }

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const vectorStr = `[${(embedding as number[]).join(",")}]`;

    const chunks = await prisma.$queryRaw<{ content: string; chunkIndex: number }[]>`
      SELECT dc.content, dc."chunkIndex"
      FROM "DocumentChunk" dc
      JOIN "SessionDocument" sd ON dc."documentId" = sd.id
      WHERE sd."sessionId" = ${req.params.id}
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> ${vectorStr}::vector
      LIMIT 3
    `;

    return res.json({ chunks });
  } catch (err) {
    console.error("[advisor POST search]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

export default router;
