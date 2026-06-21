# Strategy Room — Design Spec
**Date:** 2026-06-21  
**Status:** Approved  

---

## 1. Overview

Strategy Room is a per-session AI advisor chat added as a fourth sidebar pillar in FOUNDR. It gives founders a conversational interface to the AI that is pre-loaded with their War Room context (canvas, assumptions, Launchpad outputs) and can search uploaded business documents via RAG.

**Key decisions:**
- One chat thread per War Room session (not a global chat or multi-chat list)
- Memory = full chat history sent with every message (no separate extraction step)
- File uploads use pgvector RAG: PDF text extracted, chunked, embedded, searched at query time
- Sidebar entry: "Strategy Room" with `BrainCircuit` icon

---

## 2. Architecture

### Entry Flow
- `/strategy-room` (no sessionId) → session picker page showing all user sessions, clicking one navigates to `/strategy-room?sessionId=XXX`
- `/strategy-room?sessionId=XXX` → loads chat + documents for that session, verifies ownership

### AI Call Flow (per message sent)
1. Verify auth + session ownership
2. Load session canvas (`ideaSummary`, `questionnaireResponses`, assumptions, Launchpad outputs)
3. Load full `AdvisorMessage` history for this session
4. Embed user's message via Gemini `text-embedding-004` (768 dimensions)
5. Search `DocumentChunk` for top-3 by cosine similarity (`<=>` pgvector operator via `$queryRaw`)
6. Build system prompt: canvas summary + relevant doc excerpts
7. Call `llm.ts` (Gemini primary / Groq fallback) with full history + new message
8. Save user message + AI response to `AdvisorMessage` via backend
9. Return AI response to client

### Document Upload Flow
1. User uploads PDF or text file via drag-and-drop or file picker
2. `POST /v1/sessions/:id/advisor/documents` (Express, multipart via multer)
3. Extract text: `pdf-parse` for PDFs, direct read for `.txt`/`.md`
4. Chunk into ~500-token segments with 50-token overlap
5. For each chunk: Gemini `text-embedding-004` → `DocumentChunk` row with `embedding vector(768)`
6. Return `{ documentId, chunkCount, filename }`

---

## 3. Database Changes

Three new models added to `backend/prisma/schema.prisma`:

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

model SessionDocument {
  id         String          @id @default(cuid())
  sessionId  String
  session    WarRoomSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  filename   String
  uploadedAt DateTime        @default(now())
  chunks     DocumentChunk[]
}

model DocumentChunk {
  id         String          @id @default(cuid())
  documentId String
  document   SessionDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  content    String
  chunkIndex Int
  // embedding column added via raw SQL migration (pgvector): vector(768)
}
```

`WarRoomSession` gets two new back-relations: `advisorMessages AdvisorMessage[]` and `documents SessionDocument[]`.

**pgvector setup:** The `embedding` column on `DocumentChunk` cannot be expressed in Prisma schema syntax. It is added via a raw SQL migration run after `prisma migrate dev`:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "DocumentChunk" ADD COLUMN embedding vector(768);
CREATE INDEX ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
```
Vector similarity search uses `prisma.$queryRaw` with the `<=>` cosine-distance operator.

---

## 4. Backend Endpoints (Express)

All routes mounted under `checkJwt` middleware.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/sessions/:id/advisor` | Returns `{ messages: AdvisorMessage[], documents: { id, filename, uploadedAt, chunkCount }[] }` for initial page load |
| `POST` | `/v1/sessions/:id/advisor/messages` | Bulk-save `[{ role, content }]` array (user + assistant pair per turn) |
| `POST` | `/v1/sessions/:id/advisor/documents` | Multipart upload; extract text, chunk, embed, store chunks. Returns `{ documentId, chunkCount, filename }` |
| `DELETE` | `/v1/sessions/:id/advisor/documents/:docId` | Delete document + its chunks (cascade) |

All routes verify session ownership via `requireUser` before touching data.

---

## 5. Frontend Endpoints (Next.js)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/advisor/chat` | Core chat endpoint: RAG search + LLM call + save messages via backend |

Server action: `actions/advisor.ts` — `sendAdvisorMessage(sessionId, content)` wraps the `/api/advisor/chat` call following the existing BFF pattern.

---

## 6. Frontend Components

```
app/
  strategy-room/
    page.tsx                  # Server component: auth check, session picker or advisor page
    advisor-client.tsx        # "use client" main chat + docs UI
components/
  strategy-room/
    message-list.tsx          # Scrollable message bubbles
    message-input.tsx         # Pinned textarea + send button
    document-panel.tsx        # Upload zone + document list
    session-picker.tsx        # Session selection page for /strategy-room with no sessionId
actions/
  advisor.ts                  # sendAdvisorMessage server action
```

---

## 7. UI Layout

### Chat Page (`/strategy-room?sessionId=XXX`)

```
┌──────────────────────────────────────────────────────────┐
│  Strategy Room  ·  [italic idea summary]      [Docs ▾]  │  ← header (mobile: Docs button)
├───────────────────────────┬──────────────────────────────┤
│  MESSAGE LIST             │  DOCUMENTS                   │
│  (scrollable, ~65% wide)  │  (~35% wide, desktop only)   │
│                           │                              │
│  ┌─────────────────────┐  │  ┌────────────────────────┐  │
│  │ [AI] response text  │  │  │  Drop files here or    │  │
│  └─────────────────────┘  │  │  click to upload       │  │
│                           │  └────────────────────────┘  │
│  ┌─────────────────────┐  │                              │
│  │  [You] message      │  │  pitch-deck.pdf   [✕]       │
│  └─────────────────────┘  │  business-plan.pdf [✕]      │
│                           │                              │
│                           │  ⚑ Docs are searched on    │
│                           │    each message              │
├───────────────────────────┴──────────────────────────────┤
│  [ Type your message...                      ] [Send →]  │  ← pinned input
└──────────────────────────────────────────────────────────┘
```

- AI messages: left-aligned, `BrainCircuit` icon, `bg-surface-2` bubble
- User messages: right-aligned, `bg-surface-3` bubble
- `Enter` sends; `Shift+Enter` inserts newline
- Mobile: right panel hidden; "Docs" button in header opens a bottom Sheet
- Empty state (no messages): short prompt like *"Ask me anything about your idea. I've read your War Room canvas and any documents you upload."*

### Session Picker (`/strategy-room`)
Reuses the visual style of the home page session list. Each session card gets a `BrainCircuit` action button (alongside the existing Launchpad and ArrowRight buttons) that routes to `/strategy-room?sessionId=XXX`. Also accessible from the session list on the home page.

---

## 8. System Prompt Shape

```
You are the Strategy Room advisor for FOUNDR — an AI co-pilot for early-stage founders.
You have full context on this startup idea from the founder's War Room session.

## Startup Context
Idea: {ideaSummary}

## Questionnaire Responses
{questionnaireResponses}

## Assumption Map
{assumptions — each with claim, status, explanation}

## Launchpad Outputs (if available)
{executiveSummary, validationRoadmap, marketResearch, outreachDraft — present if non-null}

## Relevant Documents (from founder's uploads, retrieved by semantic search)
{top-3 chunks}

---
Help the founder think through tradeoffs and decisions. Never present output as a "correct answer."
Represent uncertainty honestly. Surface what you don't know.
```

---

## 9. Implementation Phases

**Phase A — Chat core (no RAG)**
- DB migration: `AdvisorMessage` + `AdvisorRole` enum
- Backend: `GET /v1/.../advisor`, `POST /v1/.../advisor/messages`
- Frontend: `page.tsx`, `advisor-client.tsx`, `message-list.tsx`, `message-input.tsx`, `session-picker.tsx`
- Next.js: `/api/advisor/chat` with canvas context injection (no doc search yet)
- Sidebar item: "Strategy Room" / `BrainCircuit`

**Phase B — Documents + RAG**
- pgvector extension + raw SQL migration for `embedding vector(768)` column
- DB models: `SessionDocument`, `DocumentChunk`
- Backend: document upload endpoint (multer + pdf-parse + embed + chunk)
- Backend: document delete endpoint
- Frontend: `document-panel.tsx` (upload zone + file list)
- `/api/advisor/chat`: add embedding of user message + `$queryRaw` similarity search

---

## 10. Packages Required

**Backend:**
- `multer` — multipart file upload handling
- `pdf-parse` — PDF text extraction

**Frontend (already available):**
- `@google/genai` — Gemini embeddings via `embedContent`
- `llm.ts` — existing provider layer used as-is

**DB:**
- `pgvector` PostgreSQL extension (installed via raw SQL migration; no npm package needed)
