@AGENTS.md

# FOUNDR — Project Summary & Implementation Plan

---

## What We're Building

FOUNDR is an AI-powered startup co-pilot that helps early-stage founders move from a vague idea to a structured, validated execution plan. It is built for the USAII Global AI Hackathon 2026 (Challenge Brief 3, Direction B — Zero-to-One Builder).

The core problem: most tools either oversimplify (pros/cons lists) or overwhelm (too much information). FOUNDR sits in the middle — it uses AI to help founders *reason*, not just retrieve or generate content.

**The guiding principle:** FOUNDR surfaces information. The founder decides what to do with it.

---

## The Three Pillars

```
┌─────────────────┬───────────────────┬─────────────────┐
│   WAR ROOM      │   LAUNCHPAD       │  PITCH COACH    │
│  Challenge      │  Connect &        │  Practice &     │
│  your idea      │  Execute          │  Perform        │
└─────────────────┴───────────────────┴─────────────────┘
```

### Pillar 1 — The War Room (Primary Focus)
The core feature. Founders stress-test their idea against three AI agents in a structured debate. The output is an interactive Assumption Map — a visual canvas of what's proven versus what's still unknown — that feeds every other part of the application.

### Pillar 2 — The Launchpad (Planned)
Where founders stop thinking and start doing. Three sections: Customer Connect, Agent Workspace, and Resource Hub. Agents in this pillar read directly from the War Room's Idea Canvas so all output is calibrated to the founder's specific idea, not generic.

### Pillar 3 — The Pitch Coach (UI Shell Only)
Powered by Gemini multimodal. Analyzes founder pitches and returns structured feedback. Connects to the Idea Canvas to flag when verbal pitches contradict unvalidated assumptions. **Not built for the hackathon — placeholder UI only.**

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React 19
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Node graph:** React Flow (Assumption Map visualization — do not substitute)
- **Animation:** Framer Motion (sequential message reveals, map transitions, hover states)
- **AI calls:** All Gemini API calls originate from Next.js API routes (`/app/api/`) — never from the Express backend
- **State:** React state only — no localStorage or sessionStorage

### Backend
- **Framework:** Express 5 + TypeScript
- **ORM:** Prisma + PostgreSQL
- **Auth:** Auth0 JWT validation via `express-oauth2-jwt-bearer` — already implemented
- **Entry point:** `backend/src/index.ts` on port 3001
- **Auth sync:** `GET /v1/auth/sync` already exists — upserts user on login

### AI Model
- **Primary:** Gemini 2.0 Flash (Google AI Studio free tier)
- All Gemini calls go through a single service file: `frontend/src/lib/gemini.ts`
- All system prompts stored as named constants in `frontend/src/prompts/agents.ts`

### Infrastructure
- **Deployment:** Server at `3.133.7.139`, domain `usaii.darkermine.dev`
- **CI/CD:** GitHub Actions smart deploy on push to `master` — detects frontend vs backend changes, deploys only what changed, restarts via PM2

---

## Team

| Person | Role |
|--------|------|
| Eric | Frontend implementation, agent orchestration logic, system prompts |
| Ben | Backend (Express routes, Prisma, database, API endpoints) |
| Elaine | Product vision, idea direction |

**Note:** The War Room debate orchestration logic (sequential API calls, round management, response parsing) is Eric's responsibility. This is the most critical piece of the application and must have a clear owner.

---

## Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  auth0Id   String   @unique
  email     String   @unique
  name      String?
  picture   String?
  provider  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sessions  WarRoomSession[]
}

model WarRoomSession {
  id                     String        @id @default(cuid())
  userId                 String
  user                   User          @relation(fields: [userId], references: [id])
  ideaSummary            String
  questionnaireResponses Json
  canvas                 Json?         // The Idea Canvas — living document fed to all Launchpad agents
  status                 SessionStatus @default(IN_PROGRESS)
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt
  transcript             DebateMessage[]
  assumptions            AssumptionNode[]
}

enum SessionStatus {
  IN_PROGRESS
  COMPLETE
}

model DebateMessage {
  id        String    @id @default(cuid())
  sessionId String
  session   WarRoomSession @relation(fields: [sessionId], references: [id])
  agent     AgentRole
  round     Int
  content   String
  createdAt DateTime  @default(now())
}

enum AgentRole {
  SKEPTIC
  STRATEGIST
  OPERATOR
}

model AssumptionNode {
  id          String     @id @default(cuid())
  sessionId   String
  session     WarRoomSession @relation(fields: [sessionId], references: [id])
  claim       String
  status      NodeStatus
  explanation String
  agentSource AgentRole
  remediation Json?      // Stores founder's validation response (action, howTested, whatFound)
  createdAt   DateTime   @default(now())
}

enum NodeStatus {
  VALIDATED
  UNVALIDATED
  NEEDS_INFO
}
```

**Schema design principle:** Built to be extended. All future Launchpad and Pitch Coach features attach to `WarRoomSession` without restructuring.

---

## The Idea Canvas

The Idea Canvas is a JSON object stored in the `canvas` column on `WarRoomSession`. It is the living, shared document that every part of FOUNDR reads from and writes to.

**Shape:**
```json
{
  "ideaSummary": "string",
  "questionnaireResponses": [],
  "assumptions": [
    {
      "id": "node_001",
      "claim": "string",
      "status": "VALIDATED | UNVALIDATED | NEEDS_INFO",
      "agentSource": "SKEPTIC | STRATEGIST | OPERATOR",
      "explanation": "string",
      "remediation": {
        "action": "VALIDATE | MODIFY | REMOVE",
        "howTested": "string",
        "whatFound": "string",
        "resolvedAt": "ISO timestamp"
      }
    }
  ],
  "lastUpdated": "ISO timestamp"
}
```

**Update lifecycle:**
- War Room completes → canvas initialized with assumption nodes
- Founder remediates a node → node status and remediation fields update
- Launchpad agent runs → output appended to canvas under relevant key
- Every AI call in the entire app reads the current canvas before generating output

---

## War Room — Full Specification

### Step 1 — Idea Intake

1. Founder submits a one-liner description of their idea
2. Gemini generates 3 tailored questions specific to the idea's domain and risks (returned as JSON array)
3. Combined with 5 default questions → 8-question questionnaire presented to founder
4. Responses saved to `WarRoomSession.questionnaireResponses`
5. War Room debate begins

**Default questions (always asked):**
1. Who specifically has this problem? Describe them in one sentence.
2. How do they solve this problem today, without your product?
3. Have you spoken to anyone who has this problem? What did they say?
4. What does success look like in 90 days?
5. What's the single biggest thing that could kill this idea?

### Step 2 — The Debate (3 Rounds, 3 Agents)

**Agent Personas:**

**SKEPTIC**
- Tone: Judgmental but polite, completely neutral — never discouraging, never validating
- Method: Always Socratic — asks "what's the evidence for that?" rather than declaring weakness
- Focus: Unproven claims, wishful thinking, hidden assumptions
- Voice: Precise, measured, clinical
- Accent color: `#ef4444` red

**STRATEGIST**
- Tone: Dispassionate about the idea, genuinely interested in the market opportunity
- Method: Evaluates through data, competition, and positioning — not founder conviction
- Focus: Market size, competitive landscape, timing, differentiation
- Voice: Stoic, analytical, occasionally blunt
- Accent color: `#3b82f6` blue

**OPERATOR**
- Tone: Pragmatic and wary — respects the vision but clear-eyed about complexity
- Method: Speaks in specifics — timelines, dependencies, technical requirements, hiring needs
- Focus: What it actually takes to build this, what breaks first, what hasn't been planned for
- Voice: Direct, concrete, no fluff
- Accent color: `#22c55e` green

**Round Structure:**

*Round 1 — Opening Statements*
Each agent reads the full questionnaire output independently. Surfaces 1-2 key concerns each. They do not see each other's responses yet.

*Round 2 — Responses*
Each agent receives the full Round 1 transcript and responds to the other agents' points. Genuine disagreement is expected. The Operator might push back on the Skeptic. The Strategist might reinforce the Skeptic from a market angle.

*Round 3 — Synthesis*
All three agents receive the full transcript and collectively produce the Assumption Map as structured JSON:

```json
{
  "assumptions": [
    {
      "claim": "string",
      "status": "VALIDATED | UNVALIDATED | NEEDS_INFO",
      "explanation": "string",
      "agentSource": "SKEPTIC | STRATEGIST | OPERATOR",
      "howToTest": "string (only if UNVALIDATED or NEEDS_INFO)"
    }
  ]
}
```

**UX during debate:** Each agent's full response appears after a loading state — not streamed. Messages are labeled with agent name and round number. The founder watches the debate unfold sequentially.

Each round is a separate Gemini API call. Full transcript is passed as context into each subsequent call.

### Step 3 — The Assumption Map

After Round 3, the debate transcript gives way to the Assumption Map rendered with React Flow.

**Node design:**
- Each node = one assumption/claim
- Large enough to show truncated claim text — not just dots
- Color coded: Green (VALIDATED), Red/Orange (UNVALIDATED), Gray (NEEDS_INFO)
- Node size reflects importance — riskiest assumptions are physically larger
- Validated nodes cluster together, unvalidated cluster together
- The map reads as a health snapshot at a glance before anyone clicks

**Node interaction — Structured Response Form:**
Clicking a node opens a side panel showing: claim, explanation, agent reasoning. Below that:

- Dropdown: "I want to..." → *Validate this*, *Modify this claim*, *Remove this assumption*
- **Validate:** Two text fields — "How did you test this?" and "What did you find?"
- **Modify:** Editable text field with current claim pre-filled
- **Remove:** Confirmation prompt — "This will be excluded from your Launchpad brief."

Founder responses update the node status on the map and write to the `canvas` JSON field. Resolved nodes change color to reflect current reality.

**After the map:** A clear CTA — *"Your assumption map is ready. The Launchpad will help you act on it."* Button navigates to Launchpad placeholder. The Idea Canvas is now initialized and ready to brief Launchpad agents.

---

## Launchpad — Planned Specification

The Launchpad reads from the Idea Canvas. All agent output is calibrated to the founder's specific, evolving idea. **Build order: implement after War Room is complete.**

### Customer Connect
**In scope — outreach drafting only for now. Lead sourcing is planned but not yet implemented.**

Current implementation:
- Outreach Agent reads from the Idea Canvas and drafts personalized cold emails and LinkedIn messages for each target lead type
- Founder reviews and sends every message manually — the AI never sends on the founder's behalf
- Architecture should be designed so lead sourcing (LinkedIn searches, community surfacing, event attendee lists) can be integrated later without restructuring

Future implementation (planned):
- User Research Agent identifies ideal early customer profile from War Room output
- System surfaces real leads — LinkedIn searches, communities, subreddits, event attendee lists
- Integrates directly with outreach drafting output

### Agent Workspace (Planned — not yet implemented)
Specialized agents deployable on demand. Each reads from the shared Idea Canvas:
- **Market Research Agent** — competitive landscape, TAM analysis, trend signals
- **Marketing Agent** — landing page copy, social posts, launch messaging
- **Content Agent** — blog posts, LinkedIn thought leadership, pitch deck narrative
- **Legal Basics Agent** — plain language explainer of entity types, IP basics, NDA basics. Always flagged as non-legal-advice with human referral built in.

### Resource Hub (Planned — not yet implemented)
- Auto-generates Executive Summary from War Room output
- Stores all agent outputs in one organized place
- Founder notes section — why you, unfair advantages, origin story
- Document organizer — pitch deck, financials, one-pager
- Everything exportable and shareable

---

## Pitch Coach — UI Shell Only

- Placeholder page exists in navigation
- Powered by Gemini multimodal (future)
- Will analyze founder pitches for pacing, clarity, filler words, investor objection anticipation
- Knows the founder's Idea Canvas — will flag when verbal pitch contradicts unvalidated assumptions
- **Not built for the hackathon**

---

## Responsible AI

**Risk: False Confidence**
The War Room produces structured, authoritative-looking output. Founders may mistake this for validation. It is not — the analysis is based entirely on what the founder told the system.

**Mitigation (must be implemented):**
- Persistent disclaimer on War Room results screen: *"This analysis is based entirely on what you've told us. It does not replace talking to real customers."*
- The Launchpad's first milestone must always be customer interviews

**Human in the Loop:**
The AI never tells the founder whether their idea is worth pursuing. Two explicit human control points:
1. The Assumption Map surfaces information — the founder decides what to do with it, remediates nodes on their own terms
2. Customer Connect drafts outreach — the founder reviews and sends every message manually. The AI never sends on the founder's behalf.

---

## UI/UX Direction

**Visual reference:** `frontend/inspo.html` is the primary design inspiration for the War Room. Open it in a browser. Key elements to match:
- **Arena layout** — the three agents are positioned spatially around a central oval "debate floor" (Skeptic top, Strategist left, Operator right, Founder at bottom). This is not a linear chat layout — it reads as a room.
- **Warm dark background** (`#0f0e0c` in the inspo, `#0a0a0f` in our system) with a slightly warmer-toned arena surface
- **Serif italic "War Room" typography** for the session header — gives it a gravitas/editorial feel distinct from the rest of the app's sans-serif UI
- **Agent nodes as circles** with accent-colored strokes and subtle fill tints — not avatars or chips

The debate transcript (chat view during rounds) transitions into the arena/map view after Round 3 completes.

**Overall vibe:** Bold, energetic, startup-y. Think Vercel or Stripe. Dark background (`#0a0a0f`), sharp modern typography, saturated agent accent colors that pop.

**Color system:**
- Background: `#0a0a0f`
- Surface/card: `#111118`
- Border: `#2a2a35`
- Text primary: `#f4f4f5`
- Text secondary: `#71717a`
- Skeptic: `#ef4444`
- Strategist: `#3b82f6`
- Operator: `#22c55e`

**Layout:** Narrow left sidebar (logo, pillar nav, idea summary card) + wide main panel (debate transcript / assumption map).

**Debate transcript:** Single-column chronological chat interface. Each agent has avatar, name in accent color, and message bubble with accent left border. Sequential reveal with Framer Motion. Animated typing indicator per agent while loading.

**Navigation:** All three pillars always visible. Launchpad and Pitch Coach show locked/placeholder state — never missing pages.

**Key rules:**
- Never show raw JSON to the user
- Loading states required on every AI call
- No streaming — full response after loading state
- Never frame AI output as a verdict or recommendation to proceed/stop
- Optimize for desktop demo

---

## File Structure

```
frontend/
├── app/
│   ├── page.tsx                        # Landing / onboarding
│   ├── war-room/
│   │   ├── page.tsx                    # Idea intake + questionnaire
│   │   └── session/[id]/
│   │       └── page.tsx                # Debate + Assumption Map
│   ├── launchpad/
│   │   └── page.tsx                    # Placeholder
│   ├── pitch-coach/
│   │   └── page.tsx                    # Placeholder
│   └── api/
│       ├── war-room/
│       │   ├── questions/route.ts      # Generate tailored questions
│       │   ├── debate/route.ts         # Run debate rounds
│       │   └── assumptions/route.ts    # Generate assumption map
│       └── auth/
│           └── sync/route.ts
├── src/
│   ├── lib/
│   │   └── gemini.ts                   # All Gemini API calls
│   ├── components/
│   │   ├── war-room/
│   │   │   ├── Questionnaire.tsx
│   │   │   ├── DebateTranscript.tsx
│   │   │   └── AssumptionMap.tsx       # React Flow node graph
│   │   └── ui/                         # shadcn components
│   └── prompts/
│       └── agents.ts                   # All system prompts as named constants

backend/
├── src/
│   ├── index.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── lib/
│   │   └── prisma.ts
│   └── v1/
│       ├── auth/
│       │   └── sync.ts
│       └── sessions/
│           └── index.ts                # CRUD for WarRoomSession + canvas updates
└── prisma/
    └── schema.prisma
```

---

## What Not To Do

- Do not call Gemini from the Express backend — all AI calls go through Next.js API routes
- Do not build Launchpad agents or Pitch Coach features — placeholder pages only
- Do not stream AI responses — full response after loading state
- Do not present AI output as a verdict or definitive answer
- Do not use localStorage or sessionStorage
- Do not substitute React Flow for another graph library
- Do not inline system prompts as strings in component files — all prompts in `src/prompts/agents.ts`
- Do not skip loading states on AI calls
- Do not show all agent messages at once — sequential reveal is intentional
- Do not make the node graph look like a tree or org chart — it is a network map

---

## Hackathon Context

- **Event:** USAII Global AI Hackathon 2026, Challenge Brief 3, Direction B
- **Deadline:** Sunday June 21, 2026
- **Submission:** Devpost — working demo, 3-5 minute video, responsible AI statement
- **Judging weights:** AI Reasoning 30%, Solution Design 25%, Problem Understanding 20%, Impact 15%, Responsible AI 10%
- **Key judge question:** Why is an LLM better here than a rules engine? Answer: extracting implicit assumptions from freeform text, classifying them contextually, generating tailored validation paths, and reasoning across a multi-turn agent debate requires language understanding that rules cannot replicate.

---

## Architectural Decisions (locked)

These were explicitly decided and should not be revisited without flagging:

- **Flat file layout** — no `src/` directory. Code lives at `frontend/{app,lib,components,prompts}`. The `tsconfig.json` `@/*` alias points to `"./*"` (repo root of frontend), which correctly resolves `@/lib`, `@/components`, etc.
- **Auth enforced from the start** — `checkJwt` is applied to both `/v1/auth` and `/v1/sessions` routers in `index.ts`. Session routes are never open, even during development.
- **canvas JSON is the source of truth for assumption state** — the `AssumptionNode` table is for structured DB querying; remediation updates always go through `canvas` PATCH. The frontend reads from canvas, not from the `AssumptionNode` rows, when rendering the map.
- **No streaming** — all Gemini calls return full responses after a loading state. `EventSource` / streaming is explicitly out of scope.
- **All prompts in `prompts/agents.ts`** — zero inline prompt strings allowed in components or API routes.

---

## Development Checkpoints — When to Run the App

Run `cd frontend && npm run dev` at these moments to catch issues before the next phase builds on top:

- **After Phase 3** (frontend shell): First visual checkpoint — review sidebar layout, pillar navigation, placeholder pages, and color system. Backend not required.
- **After Phase 5** (Idea Intake): First interactive checkpoint — questionnaire flow and session creation work end-to-end. Backend + DB required.
- **After each Phase 6 step** (Debate): Run after each debate step is built — debate is sequential and complex, catch issues incrementally.
- **After each Phase 7 step** (Assumption Map): Same — run after each step before the next builds on it.

---

## Known Gotchas & Permanent Notes

### Next.js 16 — breaking changes affecting every file we write
- `params` in dynamic pages and route handlers are now **Promises** — always `await`: `const { id } = await props.params`
- `cookies()` and `headers()` in route handlers are async-only
- Turbopack is the default bundler for `next dev` and `next build`
- Use `RouteContext<'/path/[id]'>` for typed route params (generated by `next typegen`)

### Auth0 — access token claims
The access token only includes `sub` by default. To get `email`, `name`, and `picture` in the payload, add a custom Auth0 Action in the Login flow:
```js
event.accessToken.setCustomClaim('email', event.user.email);
event.accessToken.setCustomClaim('name', event.user.name);
event.accessToken.setCustomClaim('picture', event.user.picture);
```
Without this, `GET /v1/auth/sync` returns a 400 and the user cannot be registered.

### Prisma 7 — configuration changes from v5/v6
- `url = env("DATABASE_URL")` is **not allowed** in `schema.prisma` — connection URL lives exclusively in `prisma.config.ts`
- `PrismaClient()` requires an adapter argument: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })`
- Always run `prisma generate --config prisma.config.ts` and `prisma migrate ... --config prisma.config.ts` from `backend/`

### Pending — requires live DB
`prisma migrate dev --name war_room_models` has not been run yet. The new tables (`WarRoomSession`, `DebateMessage`, `AssumptionNode`) do not exist in any environment. Run from `backend/` with `DATABASE_URL` in `.env` before Phase 5.

---

## Change Log

### 2026-06-17 — Backend: Pre-existing bugs fixed

- Removed duplicate unrestricted `cors()` call — the configured origin allowlist was being defeated. Added `http://localhost:3000` for local dev.
- Applied `checkJwt` to `/v1/auth` router — it was defined but never mounted, so every sync call returned 401.
- Moved error handler to after route mounts — Express only catches errors from routes registered above the handler.
- Added missing `return` to `UnauthorizedError` branch to prevent fall-through.
- Guarded `payload.email` in `sync.ts` with an early 400 — Auth0 access tokens omit email by default, and the field is required+unique in Prisma.

### 2026-06-17 — Phase 0: Groundwork & Verification

- Fixed `frontend/.gitignore`: added `!.env.example` so the template file isn't swallowed by the `.env*` glob.
- Created `frontend/.env.example` and `backend/.env.example` with all required placeholder keys.
- Confirmed `tsconfig.json` alias and `components/ui/button.tsx` location are already correct — no changes needed.
- Read Next.js 16 upgrade guide; key finding: `params` must be awaited everywhere (see Gotchas above).

### 2026-06-17 — Phase 1: Prisma schema + backend compilation

- Added all new models and enums to `schema.prisma` (`WarRoomSession`, `DebateMessage`, `AssumptionNode`, three enums).
- Removed invalid `url =` from datasource block (Prisma 7 breaking change).
- Fixed `prisma.ts`: added `PrismaPg` adapter — `new PrismaClient()` with no args is a compile error in Prisma 7.
- Fixed deploy workflow: wrong PM2 start path (`index.js` → `npm -- start`); added `prisma migrate deploy`; added explicit `--config` flags.
- `prisma generate` succeeds. Migration pending (needs live DB).

### 2026-06-17 — Phase 2: Express sessions scaffolding

- Created `backend/src/middleware/requireUser.ts` — resolves `User` from JWT sub; returns null + sends response if user not found.
- Created `backend/src/v1/sessions/index.ts`:
  - `POST /v1/sessions` — create session, return id
  - `GET /v1/sessions/:id` — fetch session + transcript + assumptions, owner-checked
  - `PATCH /v1/sessions/:id` — update canvas/status, append messages, replace assumptions; all in a transaction
- Mounted under `/v1/sessions` with `checkJwt` in `index.ts`.
- `tsc --noEmit` passes clean.

### 2026-06-17 — Sessions router hardening (post-review)

- Added `@@unique([sessionId, agent, round])` to `DebateMessage` + `skipDuplicates: true` on createMany — retries are now idempotent.
- Changed assumption writes to delete-then-recreate — no natural unique key; this is the safe idempotency pattern.
- Changed ownership checks to `findFirst({ where: { id, userId } })` — eliminates the 403 vs 404 session-existence leak.
- Added runtime enum/type validation to all PATCH/POST inputs — bad data now returns a 400 instead of a Prisma 500.
- Created root `.gitignore` with `.DS_Store` and `node_modules/`.