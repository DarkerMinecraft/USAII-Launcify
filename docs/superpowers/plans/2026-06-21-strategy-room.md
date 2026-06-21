# Strategy Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-session AI advisor chat ("Strategy Room") as a fourth sidebar pillar, with War Room canvas context injection, persistent message history, and document RAG via pgvector + AWS S3.

**Architecture:** Phase A delivers a working chat with canvas context (no file uploads). Phase B layers document upload to S3 `usaii-launchify`, text extraction, pgvector chunked embeddings, and semantic search injected into every message. All LLM calls go through `frontend/lib/llm.ts` (server actions pattern — no new Next.js API routes). The Express backend owns all storage: `AdvisorMessage`, `SessionDocument`, `DocumentChunk` tables, plus pgvector similarity search. A new `advisor` sub-router mounts under `sessionsRouter` with `mergeParams: true`.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Express 5, Prisma 7 + PostgreSQL, pgvector extension, AWS S3 (`@aws-sdk/client-s3`), `pdf-parse`, `multer`, `@google/genai` (multi-turn chat + embeddings), shadcn/ui, Tailwind CSS 4, Framer Motion.

## Global Constraints

- All Prisma commands: `cd backend && npx prisma migrate dev --config prisma.config.ts`
- All LLM calls: server actions (`"use server"`) only — never from client components
- All Express backend calls: via `forwardToBackend()` in `frontend/lib/backend.ts`
- No `localStorage` or `sessionStorage`
- No inline prompt strings in component files — prompts in `frontend/prompts/`
- Auth middleware: `checkJwt` already applied at `/v1/sessions` mount — sub-router inherits it
- S3 bucket name: `usaii-launchify`
- Gemini embedding model: `text-embedding-004` (768 dimensions)
- TypeScript check after each task: `cd frontend && npx tsc --noEmit`

---

## Phase A — Chat Core

---

### Task 1: DB migration — AdvisorMessage

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `AdvisorMessage` Prisma model, `AdvisorRole` enum, `advisorMessages` back-relation on `WarRoomSession`; Prisma-generated client types used in Tasks 2 and 4.

- [ ] **Step 1: Add models to schema**

Open `backend/prisma/schema.prisma` and add after the `NodeStatus` enum:

```prisma
model AdvisorMessage {
  id        String         @id @default(cuid())
  sessionId String
  session   WarRoomSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      AdvisorRole
  content   String
  createdAt DateTime       @default(now())
}

enum AdvisorRole {
  USER
  ASSISTANT
}
```

Add two back-relations to the `WarRoomSession` model (after the existing `assumptions` and `transcript` lines):

```prisma
  advisorMessages AdvisorMessage[]
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --config prisma.config.ts --name strategy_room_phase_a
```

Expected output: `✔ Generated Prisma Client` and a new migration folder under `backend/prisma/migrations/`.

- [ ] **Step 3: Verify generated types**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors. The `AdvisorMessage` and `AdvisorRole` types are now importable from `../../generated/prisma/client`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add AdvisorMessage model and AdvisorRole enum"
```

---

### Task 2: Backend advisor sub-router (GET + POST /messages)

**Files:**
- Create: `backend/src/v1/advisor/index.ts`
- Modify: `backend/src/v1/sessions/index.ts` (mount sub-router)

**Interfaces:**
- Consumes: `requireUser` from `../../middleware/require-user`, `prisma` from `../../lib/prisma`, `AdvisorRole` from `../../generated/prisma/client`
- Produces:
  - `GET /v1/sessions/:id/advisor` → `{ messages: AdvisorMessage[], documents: [] }`
  - `POST /v1/sessions/:id/advisor/messages` → `{ saved: number }`

- [ ] **Step 1: Create advisor router**

Create `backend/src/v1/advisor/index.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/require-user";

// mergeParams so req.params.id (session id) is accessible from parent router
const router = Router({ mergeParams: true });

const MessageSchema = z.object({
  role: z.enum(["USER", "ASSISTANT"]),
  content: z.string().min(1),
});

// GET /v1/sessions/:id/advisor
router.get("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const session = await prisma.warRoomSession.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ error: "session_not_found" });

    const messages = await prisma.advisorMessage.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    return res.json({ messages, documents: [] });
  } catch (err) {
    console.error("[advisor GET]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});

// POST /v1/sessions/:id/advisor/messages
router.post("/messages", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const session = await prisma.warRoomSession.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ error: "session_not_found" });

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

export default router;
```

- [ ] **Step 2: Mount sub-router in sessions router**

Open `backend/src/v1/sessions/index.ts`. Add after the existing imports at the top:

```typescript
import advisorRouter from "../advisor";
```

Add the sub-router mount BEFORE the `router.get("/:id", ...)` handler (around line 41, before the existing route handlers). Find this comment block:

```typescript
// POST /v1/sessions
router.post("/", async (req, res) => {
```

Add before it:

```typescript
router.use("/:id/advisor", advisorRouter);
```

- [ ] **Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

With the backend running (`cd backend && npm run dev`), run:

```bash
# Replace TOKEN and SESSION_ID with real values from a logged-in session
curl -X GET http://localhost:3001/v1/sessions/SESSION_ID/advisor \
  -H "Authorization: Bearer TOKEN"
```

Expected: `{"messages":[],"documents":[]}` with status 200.

- [ ] **Step 5: Commit**

```bash
git add backend/src/v1/advisor/index.ts backend/src/v1/sessions/index.ts
git commit -m "feat(backend): add advisor sub-router with GET and POST /messages"
```

---

### Task 3: Multi-turn Gemini chat + advisor system prompt

**Files:**
- Modify: `frontend/lib/gemini.ts`
- Create: `frontend/prompts/advisor.ts`

**Interfaces:**
- Produces:
  - `callGeminiChat(systemPrompt: string, history: ChatMessage[], currentMessage: string): Promise<string>` (exported from `frontend/lib/gemini.ts`)
  - `ChatMessage` interface (exported from `frontend/lib/gemini.ts`)
  - `buildAdvisorSystemPrompt(session: SessionData, docChunks?: string[]): string` (exported from `frontend/prompts/advisor.ts`)

- [ ] **Step 1: Add multi-turn chat function to gemini.ts**

Open `frontend/lib/gemini.ts`. After the existing `callGemini` function, add:

```typescript
export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export const callGeminiChat = async (
  systemPrompt: string,
  history: ChatMessage[],
  currentMessage: string,
): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }

  const contents = [
    ...history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: "user" as const, parts: [{ text: currentMessage }] },
  ];

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: systemPrompt, temperature: 0.7 },
    });
    text = response.text;
  } catch (err) {
    throw new GeminiError(
      `Gemini chat request failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  if (!text || !text.trim()) {
    throw new GeminiError("Gemini returned an empty chat response");
  }

  return text;
};
```

- [ ] **Step 2: Create advisor system prompt**

Create `frontend/prompts/advisor.ts`:

```typescript
import type { SessionData, AssumptionNode, QA } from "@/lib/types";

const formatQA = (qa: QA) => `Q: ${qa.question}\nA: ${qa.answer || "(not answered)"}`;

const formatAssumption = (a: AssumptionNode) =>
  `[${a.status}] ${a.claim}\n  Source: ${a.agentSource} — ${a.explanation}${a.howToTest ? `\n  How to test: ${a.howToTest}` : ""}`;

export const buildAdvisorSystemPrompt = (session: SessionData, docChunks: string[] = []): string => {
  const canvas = session.canvas;
  const assumptions = canvas?.assumptions ?? [];
  const qas = session.questionnaireResponses ?? [];

  const assumptionBlock = assumptions.length
    ? assumptions.map(formatAssumption).join("\n\n")
    : "No assumptions mapped yet.";

  const questionnaireBlock = qas.length
    ? qas.map(formatQA).join("\n\n")
    : "No questionnaire responses recorded.";

  const launchpadBlock = [
    session.executiveSummary ? "Executive Summary: available" : null,
    session.validationRoadmap ? "Validation Roadmap: available" : null,
    session.marketResearch ? "Market Research: available" : null,
    session.outreachDraft ? "Outreach Draft: available" : null,
  ]
    .filter(Boolean)
    .join("\n") || "No Launchpad outputs generated yet.";

  const docBlock = docChunks.length
    ? docChunks.map((c, i) => `--- Document excerpt ${i + 1} ---\n${c}`).join("\n\n")
    : "";

  return `You are the Strategy Room advisor for FOUNDR — an AI co-pilot for early-stage founders.
You have full context on this startup idea from the founder's War Room session.
Help the founder think through tradeoffs and decisions. Never present output as a "correct answer" or verdict.
Represent uncertainty honestly. Surface what you don't know.

## Startup Idea
${session.ideaSummary}

## Questionnaire Responses
${questionnaireBlock}

## Assumption Map
${assumptionBlock}

## Launchpad Status
${launchpadBlock}
${docBlock ? `\n## Relevant Document Excerpts (retrieved by semantic search)\n${docBlock}` : ""}`.trim();
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/gemini.ts frontend/prompts/advisor.ts
git commit -m "feat(llm): add callGeminiChat multi-turn + advisor system prompt builder"
```

---

### Task 4: Advisor server actions + types

**Files:**
- Modify: `frontend/lib/types.ts`
- Create: `frontend/actions/advisor.ts`

**Interfaces:**
- Consumes: `callGeminiChat`, `ChatMessage` from `@/lib/gemini`; `buildAdvisorSystemPrompt` from `@/prompts/advisor`; `forwardToBackend`, `ensureUserSynced` from `@/lib/backend`; `SessionData` from `@/lib/types`
- Produces:
  - `getAdvisorData(sessionId: string): Promise<AdvisorData>`
  - `sendAdvisorMessage(sessionId: string, content: string): Promise<{ content: string }>`
  - `AdvisorMessage`, `AdvisorDocument`, `AdvisorData` types (exported from `@/lib/types`)

- [ ] **Step 1: Add advisor types to lib/types.ts**

Open `frontend/lib/types.ts` and append at the end:

```typescript
export type AdvisorMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
};

export type AdvisorDocument = {
  id: string;
  filename: string;
  uploadedAt: string;
  chunkCount: number;
};

export type AdvisorData = {
  messages: AdvisorMessage[];
  documents: AdvisorDocument[];
};
```

- [ ] **Step 2: Create advisor server action**

Create `frontend/actions/advisor.ts`:

```typescript
"use server";

import { GeminiError } from "@/lib/gemini";
import { callGeminiChat } from "@/lib/gemini";
import { buildAdvisorSystemPrompt } from "@/prompts/advisor";
import { forwardToBackend, ensureUserSynced, BackendAuthError, BackendError } from "@/lib/backend";
import type { SessionData, AdvisorData } from "@/lib/types";

class ActionAuthError extends Error {}
class ActionError extends Error {}

const handleBackendError = (err: unknown): never => {
  if (err instanceof BackendAuthError) throw new ActionAuthError("You must sign in first");
  if (err instanceof BackendError) throw new ActionError(err.message);
  throw new ActionError("Could not reach the backend");
};

export const getAdvisorData = async (sessionId: string): Promise<AdvisorData> => {
  try {
    await ensureUserSynced();
    return await forwardToBackend<AdvisorData>(`/v1/sessions/${sessionId}/advisor`);
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const sendAdvisorMessage = async (
  sessionId: string,
  content: string,
): Promise<{ content: string }> => {
  try {
    await ensureUserSynced();

    const [advisorData, session] = await Promise.all([
      forwardToBackend<AdvisorData>(`/v1/sessions/${sessionId}/advisor`),
      forwardToBackend<SessionData>(`/v1/sessions/${sessionId}`),
    ]);

    const history = advisorData.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("model" as const),
      text: m.content,
    }));

    const systemPrompt = buildAdvisorSystemPrompt(session);
    const reply = await callGeminiChat(systemPrompt, history, content);

    await forwardToBackend(`/v1/sessions/${sessionId}/advisor/messages`, {
      method: "POST",
      data: [
        { role: "USER", content },
        { role: "ASSISTANT", content: reply },
      ],
    });

    return { content: reply };
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    if (err instanceof GeminiError) throw new ActionError("AI advisor is temporarily unavailable");
    handleBackendError(err);
  }
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/types.ts frontend/actions/advisor.ts
git commit -m "feat(actions): add getAdvisorData and sendAdvisorMessage server actions"
```

---

### Task 5: Strategy Room page + session picker

**Files:**
- Create: `frontend/app/strategy-room/page.tsx`
- Create: `frontend/components/strategy-room/session-picker.tsx`

**Interfaces:**
- Consumes: `getAdvisorData`, `sendAdvisorMessage` from `@/actions/advisor`; `listSessions` from `@/actions/sessions`; `auth0` from `@/lib/auth0`; `AdvisorClient` from `./advisor-client` (created in Task 6 — create a stub first, then Task 6 fills it in)
- Produces: `/strategy-room` route (session picker) and `/strategy-room?sessionId=XXX` route (chat)

- [ ] **Step 1: Create SessionPicker component**

Create `frontend/components/strategy-room/session-picker.tsx`:

```typescript
"use client";

import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  ideaSummary: string;
  status: "IN_PROGRESS" | "COMPLETE";
  createdAt: string;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const SessionPicker = ({ sessions }: { sessions: Session[] }) => {
  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center">
        <BrainCircuit className="w-8 h-8 text-text-faint mx-auto mb-4" />
        <p className="font-serif italic text-[16px] text-text-faint mb-2">No sessions yet.</p>
        <p className="text-[13px] text-text-faint mb-6">
          Complete a War Room session to open the Strategy Room.
        </p>
        <Button asChild>
          <Link href="/war-room">Go to War Room</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => (
        <Card
          key={s.id}
          className="bg-surface-1 rounded-[11px] shadow-none ring-0 border-border gap-0 py-0 overflow-hidden"
        >
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="font-serif italic text-[14px] text-foreground leading-[1.35]">
                {truncate(s.ideaSummary, 90)}
              </p>
              <p className="eyebrow-sm mt-1">{formatDate(s.createdAt)}</p>
            </div>
            <Button size="sm" className="shrink-0 gap-1.5 rounded-[8px]" asChild>
              <Link href={`/strategy-room?sessionId=${s.id}`}>
                <BrainCircuit className="w-3.5 h-3.5" />
                Open
              </Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Create a stub AdvisorClient so the page can import it**

Create `frontend/app/strategy-room/advisor-client.tsx`:

```typescript
"use client";

// Stub — replaced in Task 6
export const AdvisorClient = (_props: {
  sessionId: string;
  ideaSummary: string;
  initialMessages: { id: string; role: "USER" | "ASSISTANT"; content: string; createdAt: string }[];
  initialDocuments: { id: string; filename: string; uploadedAt: string; chunkCount: number }[];
}) => (
  <div className="flex items-center justify-center h-full text-text-faint text-[13px]">
    Loading Strategy Room…
  </div>
);
```

- [ ] **Step 3: Create the page**

Create `frontend/app/strategy-room/page.tsx`:

```typescript
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import { Button } from "@/components/ui/button";
import { listSessions } from "@/actions/sessions";
import { getAdvisorData } from "@/actions/advisor";
import { SessionPicker } from "@/components/strategy-room/session-picker";
import { AdvisorClient } from "./advisor-client";

export const metadata: Metadata = {
  title: "Strategy Room",
  robots: { index: false, follow: false },
};

const StrategyRoomPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) => {
  const authSession = await auth0.getSession();

  if (!authSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-8 py-16 text-center">
        <BrainCircuit className="w-8 h-8 text-text-faint mx-auto mb-6" />
        <p className="font-serif italic mb-6 text-[26px] text-foreground">
          Sign in to open Strategy Room.
        </p>
        <Button size="lg" className="text-[14.5px] rounded-[9px]" asChild>
          <a href="/auth/login">Sign in to continue</a>
        </Button>
      </div>
    );
  }

  const { sessionId } = await searchParams;

  // No sessionId → show session picker
  if (!sessionId) {
    let sessions: Awaited<ReturnType<typeof listSessions>> = [];
    try {
      sessions = (await listSessions()) ?? [];
    } catch {
      sessions = [];
    }

    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <BrainCircuit className="w-5 h-5 text-text-faint" />
          <h1 className="font-serif italic text-[22px] text-foreground">Strategy Room</h1>
        </div>
        <p className="text-[14px] text-text-muted mb-6">
          Choose a War Room session to open its advisor chat.
        </p>
        <SessionPicker sessions={sessions} />
      </main>
    );
  }

  // sessionId present → load advisor data server-side
  let advisorData;
  let session;
  try {
    const [ad, s] = await Promise.all([
      getAdvisorData(sessionId),
      import("@/actions/sessions").then((m) => m.getSession(sessionId)),
    ]);
    advisorData = ad;
    session = s;
  } catch {
    redirect("/strategy-room");
  }

  if (!session) redirect("/strategy-room");

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      <AdvisorClient
        sessionId={sessionId}
        ideaSummary={session.ideaSummary}
        initialMessages={advisorData.messages}
        initialDocuments={advisorData.documents}
      />
    </div>
  );
};

export default StrategyRoomPage;
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/strategy-room/ frontend/components/strategy-room/session-picker.tsx
git commit -m "feat(ui): add Strategy Room page and session picker"
```

---

### Task 6: Chat UI components — MessageList, MessageInput, AdvisorClient

**Files:**
- Create: `frontend/components/strategy-room/message-list.tsx`
- Create: `frontend/components/strategy-room/message-input.tsx`
- Modify (replace stub): `frontend/app/strategy-room/advisor-client.tsx`

**Interfaces:**
- Consumes: `sendAdvisorMessage` from `@/actions/advisor`; `AdvisorMessage`, `AdvisorDocument` from `@/lib/types`; shadcn `Button`, `Card`
- Produces: `AdvisorClient` (full implementation), `MessageList`, `MessageInput` components

- [ ] **Step 1: Create MessageList**

Create `frontend/components/strategy-room/message-list.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { BrainCircuit, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvisorMessage } from "@/lib/types";

export const MessageList = ({
  messages,
  sending,
}: {
  messages: AdvisorMessage[];
  sending: boolean;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <BrainCircuit className="w-8 h-8 text-text-faint mb-4" />
        <p className="font-serif italic text-[15px] text-text-faint leading-relaxed max-w-sm">
          Ask me anything about your idea. I've read your War Room canvas and any documents you
          upload.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
      {messages.map((m) =>
        m.role === "ASSISTANT" ? (
          <div key={m.id} className="flex gap-3 max-w-[80%]">
            <div className="shrink-0 w-6 h-6 rounded-full bg-surface-3 border border-border flex items-center justify-center mt-0.5">
              <BrainCircuit className="w-3 h-3 text-text-faint" />
            </div>
            <div className="bg-surface-2 border border-border rounded-[11px] px-4 py-3 text-[13.5px] text-foreground leading-relaxed whitespace-pre-wrap">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex justify-end">
            <div className="bg-surface-3 border border-border rounded-[11px] px-4 py-3 text-[13.5px] text-foreground leading-relaxed max-w-[80%] whitespace-pre-wrap">
              {m.content}
            </div>
          </div>
        ),
      )}
      {sending && (
        <div className="flex gap-3 max-w-[80%]">
          <div className="shrink-0 w-6 h-6 rounded-full bg-surface-3 border border-border flex items-center justify-center mt-0.5">
            <BrainCircuit className="w-3 h-3 text-text-faint" />
          </div>
          <div className="bg-surface-2 border border-border rounded-[11px] px-4 py-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-text-faint" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
```

- [ ] **Step 2: Create MessageInput**

Create `frontend/components/strategy-room/message-input.tsx`:

```typescript
"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MessageInput = ({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled: boolean;
}) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 bg-background">
      <div className="flex items-end gap-2 bg-surface-1 border border-border rounded-[11px] px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Type your message…"
          rows={1}
          disabled={disabled}
          className={cn(
            "flex-1 resize-none bg-transparent text-[13.5px] text-foreground placeholder:text-text-faint outline-none leading-relaxed py-0.5 min-h-[24px] max-h-[180px]",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
        <Button
          size="icon-sm"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-[7px]"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
      </div>
      <p className="eyebrow-sm text-text-faint mt-1.5 px-1">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
};
```

- [ ] **Step 3: Replace advisor-client stub with full implementation**

Replace the entire contents of `frontend/app/strategy-room/advisor-client.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { sendAdvisorMessage } from "@/actions/advisor";
import { MessageList } from "@/components/strategy-room/message-list";
import { MessageInput } from "@/components/strategy-room/message-input";
import type { AdvisorMessage, AdvisorDocument } from "@/lib/types";

interface Props {
  sessionId: string;
  ideaSummary: string;
  initialMessages: AdvisorMessage[];
  initialDocuments: AdvisorDocument[];
}

export const AdvisorClient = ({ sessionId, ideaSummary, initialMessages }: Props) => {
  const [messages, setMessages] = useState<AdvisorMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(
    async (content: string) => {
      const optimistic: AdvisorMessage = {
        id: crypto.randomUUID(),
        role: "USER",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setSending(true);

      try {
        const { content: reply } = await sendAdvisorMessage(sessionId, content);
        const assistant: AdvisorMessage = {
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: reply,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistant]);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        toast.error("Could not reach the advisor — try again");
      } finally {
        setSending(false);
      }
    },
    [sessionId],
  );

  const truncated =
    ideaSummary.length > 80 ? `${ideaSummary.slice(0, 79).trimEnd()}…` : ideaSummary;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <BrainCircuit className="w-4 h-4 text-text-faint shrink-0" />
        <span className="font-mono uppercase text-[10px] tracking-[0.12em] text-text-dim shrink-0">
          Strategy Room
        </span>
        <span className="text-text-faint mx-0.5">·</span>
        <p className="font-serif italic text-[12.5px] text-text-muted truncate">{truncated}</p>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0">
          <MessageList messages={messages} sending={sending} />
          <MessageInput onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Start both apps (`cd frontend && npm run dev` and `cd backend && npm run dev`). Navigate to `/strategy-room`. You should see the session picker. Click a session. You should see the chat interface. Send a message and receive a reply.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/strategy-room/ frontend/app/strategy-room/advisor-client.tsx
git commit -m "feat(ui): add Strategy Room chat UI — MessageList, MessageInput, AdvisorClient"
```

---

### Task 7: Sidebar + mobile nav + session list integration

**Files:**
- Modify: `frontend/components/sidebar.tsx`
- Modify: `frontend/components/mobile-nav.tsx`
- Modify: `frontend/components/home/session-list.tsx`

**Interfaces:**
- Consumes: `BrainCircuit` from `lucide-react`; existing `pillars` array and `SessionList` structure
- Produces: "Strategy Room" as 4th sidebar pillar; Strategy Room action button on each session card

- [ ] **Step 1: Add Strategy Room to sidebar pillars**

Open `frontend/components/sidebar.tsx`. Find the `pillars` array. Add "Strategy Room" as the fourth entry:

```typescript
// Add BrainCircuit to the lucide-react import line
import { Swords, Rocket, Mic, BrainCircuit, Lock, LogIn, Settings } from "lucide-react";

// In the pillars array, add after the Pitch Session entry:
{
  label: "Strategy Room",
  href: "/strategy-room",
  icon: BrainCircuit,
  locked: false,
  description: "Advise & explore",
  dotActiveClass: "bg-agent-strategist shadow-[0_0_8px_var(--agent-strategist)]",
  descActiveClass: "text-agent-strategist",
},
```

Also update the `<p>` label above the nav from "The Three Pillars" to "Pillars":

```typescript
<p className="eyebrow px-3 pb-2 pt-1">
  Pillars
</p>
```

- [ ] **Step 2: Add Strategy Room to mobile nav**

Open `frontend/components/mobile-nav.tsx`. Locate where the pillar links are listed (War Room, Launchpad, Pitch Session). Add Strategy Room after Pitch Session:

```typescript
// Add BrainCircuit to imports from lucide-react
// Add this Link entry alongside the others:
<Link href="/strategy-room" className={cn(/* same classes as sibling links */)}>
  <BrainCircuit className="w-[18px] h-[18px]" aria-hidden="true" />
  <span>Strategy</span>
</Link>
```

Read the exact className from the sibling War Room link and replicate it exactly.

- [ ] **Step 3: Add BrainCircuit action button to SessionList**

Open `frontend/components/home/session-list.tsx`. Add `BrainCircuit` to the lucide-react import. Then, inside the `{s.status === "COMPLETE" && ...}` block that already shows the Launchpad button, add a Strategy Room button immediately after:

```typescript
// After the existing Launchpad Tooltip/Button block, add:
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Open Strategy Room"
      className="text-agent-strategist bg-[rgba(111,147,193,0.1)] border border-[rgba(111,147,193,0.25)] hover:bg-[rgba(111,147,193,0.2)] hover:border-[rgba(111,147,193,0.5)]"
      asChild
    >
      <Link href={`/strategy-room?sessionId=${s.id}`}>
        <BrainCircuit className="w-[11px] h-[11px]" aria-hidden="true" />
      </Link>
    </Button>
  </TooltipTrigger>
  <TooltipContent>Open Strategy Room</TooltipContent>
</Tooltip>
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify visually**

Run `cd frontend && npm run dev`. Confirm:
- Sidebar shows "Strategy Room" as 4th pillar
- Session cards on home page show a second action icon (BrainCircuit) that links to `/strategy-room?sessionId=XXX`
- Mobile nav shows Strategy Room link

- [ ] **Step 6: Commit**

```bash
git add frontend/components/sidebar.tsx frontend/components/mobile-nav.tsx frontend/components/home/session-list.tsx
git commit -m "feat(nav): add Strategy Room to sidebar, mobile nav, and session list"
```

---

## Phase B — Documents + RAG

---

### Task 8: DB migration — SessionDocument, DocumentChunk + pgvector

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Shell: raw SQL to add `embedding vector(768)` and HNSW index

**Interfaces:**
- Produces: `SessionDocument`, `DocumentChunk` Prisma models; `documents` back-relation on `WarRoomSession`; pgvector extension + embedding column available for `$queryRaw` in Task 9.

- [ ] **Step 1: Add models to schema**

Open `backend/prisma/schema.prisma`. Add after the `AdvisorMessage` model:

```prisma
model SessionDocument {
  id         String          @id @default(cuid())
  sessionId  String
  session    WarRoomSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  filename   String
  s3Key      String
  uploadedAt DateTime        @default(now())
  chunks     DocumentChunk[]
}

model DocumentChunk {
  id         String          @id @default(cuid())
  documentId String
  document   SessionDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  content    String
  chunkIndex Int
}
```

Add two back-relations to the `WarRoomSession` model:

```prisma
  documents SessionDocument[]
```

- [ ] **Step 2: Run Prisma migration**

```bash
cd backend && npx prisma migrate dev --config prisma.config.ts --name strategy_room_phase_b
```

Expected: new migration folder created, Prisma client regenerated.

- [ ] **Step 3: Install pgvector extension and add embedding column**

Run against the local Docker Postgres (`foundr-db` container):

```bash
docker exec -i foundr-db psql -U foundr -d foundr << 'EOF'
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
  ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
EOF
```

Expected output:
```
CREATE EXTENSION
ALTER TABLE
CREATE INDEX
```

> **Note for production deployment:** Run the same three SQL statements against the production Postgres instance before deploying Phase B. pgvector must be installed on the server (`apt install postgresql-16-pgvector` or the equivalent).

- [ ] **Step 4: Verify**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add SessionDocument, DocumentChunk models for RAG pipeline"
```

---

### Task 9: S3 helper + document upload/delete/search backend endpoints

**Files:**
- Create: `backend/src/lib/s3.ts`
- Modify: `backend/src/v1/advisor/index.ts`
- Modify: `backend/package.json` (new deps: `@aws-sdk/client-s3`, `multer`, `pdf-parse`, `@types/multer`, `@types/pdf-parse`)

**Interfaces:**
- Consumes: `S3Client`, `PutObjectCommand`, `DeleteObjectCommand` from `@aws-sdk/client-s3`; `multer` for multipart; `pdf-parse` for PDF text extraction; `prisma.$queryRaw` for vector search
- Produces:
  - `POST /v1/sessions/:id/advisor/documents` → `{ documentId, chunkCount, filename }`
  - `DELETE /v1/sessions/:id/advisor/documents/:docId` → 204
  - `POST /v1/sessions/:id/advisor/search` → `{ chunks: { content: string; chunkIndex: number }[] }`
  - `GET /v1/sessions/:id/advisor` updated to include real documents with `chunkCount`

- [ ] **Step 1: Install backend dependencies**

```bash
cd backend && npm install @aws-sdk/client-s3 multer pdf-parse
cd backend && npm install --save-dev @types/multer @types/pdf-parse
```

Expected: packages added to `package.json` and installed.

- [ ] **Step 2: Create S3 helper**

Create `backend/src/lib/s3.ts`:

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "usaii-launchify";

export const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

export const uploadToS3 = async (key: string, body: Buffer, contentType: string): Promise<void> => {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};
```

- [ ] **Step 3: Add env vars to backend/.env**

Add to `backend/.env`:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=usaii-launchify
```

- [ ] **Step 4: Update advisor router with document endpoints and real GET**

Replace the full contents of `backend/src/v1/advisor/index.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import pdfParse from "pdf-parse";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/require-user";
import { uploadToS3, deleteFromS3 } from "../../lib/s3";

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

router.get("/", async (req, res) => {
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

router.post("/messages", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const parsed = z.array(MessageSchema).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten().fieldErrors });

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

router.post("/documents", upload.single("file"), async (req, res) => {
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
      const parsed = await pdfParse(buffer);
      text = parsed.text;
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

router.delete("/documents/:docId", async (req, res) => {
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

router.post("/search", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { embedding } = req.body;
  if (!Array.isArray(embedding) || embedding.length !== 768) {
    return res.status(400).json({ error: "embedding must be a 768-element number array" });
  }

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const vectorStr = `[${embedding.join(",")}]`;

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
```

- [ ] **Step 5: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

With backend running:

```bash
# Upload a PDF (replace TOKEN and SESSION_ID)
curl -X POST http://localhost:3001/v1/sessions/SESSION_ID/advisor/documents \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/test.pdf"
```

Expected: `{"documentId":"...","chunkCount":N,"filename":"test.pdf"}` with status 201.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/s3.ts backend/src/v1/advisor/index.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add S3 upload, document chunking, and vector search endpoints"
```

---

### Task 10: Gemini embeddings + RAG in sendAdvisorMessage

**Files:**
- Modify: `frontend/lib/gemini.ts`
- Modify: `frontend/actions/advisor.ts`

**Interfaces:**
- Consumes: `ai.models.embedContent` from `@google/genai`; `forwardToBackend` for `/advisor/search`
- Produces:
  - `embedText(text: string): Promise<number[]>` (exported from `frontend/lib/gemini.ts`)
  - `sendAdvisorMessage` updated to embed user message, search chunks, inject into system prompt

- [ ] **Step 1: Add embedText to gemini.ts**

Open `frontend/lib/gemini.ts`. Add after `callGeminiChat`:

```typescript
export const embedText = async (text: string): Promise<number[]> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }
  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    const values = response.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new GeminiError("Embedding returned no values");
    }
    return values;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    throw new GeminiError(
      `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
};
```

- [ ] **Step 2: Update sendAdvisorMessage to use RAG**

Open `frontend/actions/advisor.ts`. Replace the `sendAdvisorMessage` export with this RAG-enabled version:

```typescript
import { GeminiError, callGeminiChat, embedText } from "@/lib/gemini";

export const sendAdvisorMessage = async (
  sessionId: string,
  content: string,
): Promise<{ content: string }> => {
  try {
    await ensureUserSynced();

    const [advisorData, session] = await Promise.all([
      forwardToBackend<AdvisorData>(`/v1/sessions/${sessionId}/advisor`),
      forwardToBackend<SessionData>(`/v1/sessions/${sessionId}`),
    ]);

    // Embed user message and search for relevant document chunks
    let docChunks: string[] = [];
    if (advisorData.documents.length > 0) {
      try {
        const embedding = await embedText(content);
        const searchResult = await forwardToBackend<{ chunks: { content: string }[] }>(
          `/v1/sessions/${sessionId}/advisor/search`,
          { method: "POST", data: { embedding } },
        );
        docChunks = searchResult.chunks.map((c) => c.content);
      } catch {
        // RAG failure is non-fatal — proceed without doc context
      }
    }

    const history = advisorData.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("model" as const),
      text: m.content,
    }));

    const systemPrompt = buildAdvisorSystemPrompt(session, docChunks);
    const reply = await callGeminiChat(systemPrompt, history, content);

    await forwardToBackend(`/v1/sessions/${sessionId}/advisor/messages`, {
      method: "POST",
      data: [
        { role: "USER", content },
        { role: "ASSISTANT", content: reply },
      ],
    });

    return { content: reply };
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    if (err instanceof GeminiError) throw new ActionError("AI advisor is temporarily unavailable");
    handleBackendError(err);
  }
};
```

Also update the imports at the top of `frontend/actions/advisor.ts` to include `embedText`:

```typescript
import { GeminiError, callGeminiChat, embedText } from "@/lib/gemini";
```

- [ ] **Step 3: Add embedding to document chunks on upload**

The backend's document upload endpoint (Task 9) stores chunks without embeddings. Now that the frontend has `embedText`, the embedding must happen server-side from the backend (Express cannot call Gemini directly per project rules — all LLM calls from Next.js). 

The simplest compliant approach: after the frontend server action creates a document, it triggers chunk embedding. Add a new server action to `frontend/actions/advisor.ts`:

```typescript
// Embeds chunk texts and stores them in the backend — called after document upload.
// Failures are non-fatal: un-embedded chunks are excluded by the search query (WHERE embedding IS NOT NULL).
export const embedDocumentChunks = async (
  sessionId: string,
  documentId: string,
  chunks: string[],
): Promise<void> => {
  if (chunks.length === 0) return;
  try {
    await ensureUserSynced();
    // Embed in batches of 10 to avoid rate limits
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const batchEmbeddings = await Promise.all(batch.map((c) => embedText(c)));
      embeddings.push(...batchEmbeddings);
    }
    await forwardToBackend(`/v1/sessions/${sessionId}/advisor/documents/${documentId}/embeddings`, {
      method: "POST",
      data: { embeddings },
    });
  } catch {
    // Non-fatal — chunks stored but not yet searchable
  }
};
```

Add the corresponding backend endpoint to `backend/src/v1/advisor/index.ts` — after the document upload route:

```typescript
// POST /v1/sessions/:id/advisor/documents/:docId/embeddings
router.post("/documents/:docId/embeddings", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { embeddings } = req.body;
  if (!Array.isArray(embeddings)) return res.status(400).json({ error: "embeddings must be an array" });

  try {
    if (!(await ownsSession(req.params.id, user.id)))
      return res.status(404).json({ error: "session_not_found" });

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: req.params.docId },
      orderBy: { chunkIndex: "asc" },
      select: { id: true },
    });

    for (let i = 0; i < Math.min(chunks.length, embeddings.length); i++) {
      const vectorStr = `[${(embeddings[i] as number[]).join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${vectorStr}::vector
        WHERE id = ${chunks[i].id}
      `;
    }

    return res.json({ updated: Math.min(chunks.length, embeddings.length) });
  } catch (err) {
    console.error("[advisor POST embeddings]", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit && cd ../backend && npx tsc --noEmit
```

Expected: no errors in either project.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/gemini.ts frontend/actions/advisor.ts backend/src/v1/advisor/index.ts
git commit -m "feat(rag): add Gemini embeddings and vector search to advisor chat"
```

---

### Task 11: Document panel UI + AdvisorClient update

**Files:**
- Create: `frontend/components/strategy-room/document-panel.tsx`
- Modify: `frontend/app/strategy-room/advisor-client.tsx`

**Interfaces:**
- Consumes: `AdvisorDocument` from `@/lib/types`; `embedDocumentChunks` from `@/actions/advisor`; `forwardToBackend` (via a new `uploadDocument` server action in `advisor.ts`); shadcn `Button`, `Card`; `Sheet`, `SheetContent`, `SheetTrigger` from shadcn (install if not present: `npx shadcn@latest add sheet --yes`)
- Produces: `DocumentPanel` component (desktop sidebar + mobile sheet); full `AdvisorClient` with docs wired in

- [ ] **Step 1: Add uploadDocument and deleteDocument server actions to advisor.ts**

Open `frontend/actions/advisor.ts` and add (also add `embedDocumentChunks` import at top from Task 10 — it's in the same file):

```typescript
// uploadDocument: forwards multipart via axios (handles FormData natively),
// then embeds chunks server-side so RAG search works immediately.
export const uploadDocument = async (sessionId: string, formData: FormData): Promise<AdvisorDocument> => {
  try {
    await ensureUserSynced();
    // forwardToBackend uses axios which handles FormData and sets multipart headers automatically
    const result = await forwardToBackend<{
      documentId: string;
      chunkCount: number;
      filename: string;
      chunks: string[];
    }>(`/v1/sessions/${sessionId}/advisor/documents`, { method: "POST", data: formData });

    // Embed chunks and store embeddings so RAG search works immediately (non-blocking to caller)
    void embedDocumentChunks(sessionId, result.documentId, result.chunks);

    return {
      id: result.documentId,
      filename: result.filename,
      uploadedAt: new Date().toISOString(),
      chunkCount: result.chunkCount,
    };
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

export const deleteDocument = async (sessionId: string, documentId: string): Promise<void> => {
  try {
    await ensureUserSynced();
    await forwardToBackend(`/v1/sessions/${sessionId}/advisor/documents/${documentId}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof ActionAuthError || err instanceof ActionError) throw err;
    handleBackendError(err);
  }
};

- [ ] **Step 2: Check if Sheet is installed**

```bash
ls frontend/components/ui/sheet.tsx 2>/dev/null && echo "exists" || echo "missing"
```

If missing:
```bash
cd frontend && npx shadcn@latest add sheet --yes
```

- [ ] **Step 3: Create DocumentPanel**

Create `frontend/components/strategy-room/document-panel.tsx`:

```typescript
"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadDocument, deleteDocument } from "@/actions/advisor";
import type { AdvisorDocument } from "@/lib/types";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const DocumentPanel = ({
  sessionId,
  documents,
  onDocumentsChange,
}: {
  sessionId: string;
  documents: AdvisorDocument[];
  onDocumentsChange: (docs: AdvisorDocument[]) => void;
}) => {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, .txt, and .md files are supported");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const doc = await uploadDocument(sessionId, formData);
      onDocumentsChange([doc, ...documents]);
      toast.success(`${file.name} uploaded (${doc.chunkCount} chunks)`);
    } catch {
      toast.error("Upload failed — try again");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await deleteDocument(sessionId, docId);
      onDocumentsChange(documents.filter((d) => d.id !== docId));
    } catch {
      toast.error("Could not delete — try again");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="hidden sm:flex flex-col w-[260px] shrink-0 border-l border-border bg-surface-1 p-4 gap-4">
      <p className="eyebrow">Documents</p>

      {/* Upload zone */}
      <div
        className="border border-dashed border-border rounded-[10px] px-3 py-5 flex flex-col items-center gap-2 cursor-pointer hover:border-border/80 hover:bg-surface-2 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 text-text-faint animate-spin" />
        ) : (
          <Upload className="w-5 h-5 text-text-faint" />
        )}
        <p className="text-[11.5px] text-text-faint text-center leading-relaxed">
          {uploading ? "Uploading…" : "Drop PDF or text file\nor click to browse"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Document list */}
      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 bg-surface-2 rounded-[8px] px-2.5 py-2 border border-border"
          >
            <FileText className="w-3.5 h-3.5 text-text-faint shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] text-foreground truncate">{doc.filename}</p>
              <p className="eyebrow-sm">{formatDate(doc.uploadedAt)} · {doc.chunkCount} chunks</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-text-faint shrink-0"
              disabled={deletingId === doc.id}
              onClick={() => void handleDelete(doc.id)}
            >
              {deletingId === doc.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </Button>
          </div>
        ))}
      </div>

      {documents.length > 0 && (
        <p className="eyebrow-sm text-text-faint">
          Docs are searched on each message you send.
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Update AdvisorClient to include DocumentPanel**

Open `frontend/app/strategy-room/advisor-client.tsx`. Add `DocumentPanel` import and render it in the body section. Replace the `// Body` section:

```typescript
import { DocumentPanel } from "@/components/strategy-room/document-panel";

// In the component, add documents state (initialDocuments is already in Props):
const [documents, setDocuments] = useState<AdvisorDocument[]>(initialDocuments);

// In the body div, add DocumentPanel alongside the chat:
<div className="flex flex-1 min-h-0">
  <div className="flex flex-col flex-1 min-w-0">
    <MessageList messages={messages} sending={sending} />
    <MessageInput onSend={handleSend} disabled={sending} />
  </div>
  <DocumentPanel
    sessionId={sessionId}
    documents={documents}
    onDocumentsChange={setDocuments}
  />
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual end-to-end test**

1. Navigate to `/strategy-room?sessionId=YOUR_SESSION_ID`
2. Upload a PDF via the documents panel — confirm it appears in the list with chunk count
3. Send a message — the AI response should incorporate document context (check that chunks with embeddings are surfaced)
4. Delete a document — confirm it disappears from the list

- [ ] **Step 7: Commit**

```bash
git add frontend/components/strategy-room/document-panel.tsx frontend/app/strategy-room/advisor-client.tsx frontend/actions/advisor.ts
git commit -m "feat(ui): add document upload panel with S3 + RAG wired into Strategy Room"
```

---

## Post-Implementation Checklist

- [ ] `cd frontend && npx tsc --noEmit` — clean
- [ ] `cd backend && npx tsc --noEmit` — clean
- [ ] `/strategy-room` (no sessionId): shows session picker; clicking a session navigates to chat
- [ ] `/strategy-room?sessionId=XXX`: shows header, empty state, message input
- [ ] Sending a message: optimistic user bubble → loading spinner → AI response appears
- [ ] Sidebar shows "Strategy Room" as fourth pillar; active state highlights correctly
- [ ] Home page session cards show BrainCircuit action button for each session
- [ ] Document upload: PDF → S3, chunks stored in DB, filename + chunk count shown in panel
- [ ] Document delete: S3 object removed, card disappears from list
- [ ] RAG: after uploading a doc, sending a message about its content returns a contextually aware response
- [ ] No raw JSON visible anywhere in the UI
- [ ] All loading states present (message sending, doc uploading, doc deleting)
