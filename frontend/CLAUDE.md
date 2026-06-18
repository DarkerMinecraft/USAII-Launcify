@AGENTS.md

# FOUNDR — Project Summary & Implementation Plan

## Logging
All session logs, change records, and build notes go in `.claude/LOG.md` — not here.
After every session, append a dated entry to `LOG.md` summarizing: what was completed, decisions made, and any gotchas hit.

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

*Round 3 — Closing Statements*
Each agent receives the full Rounds 1–2 transcript and gives an independent closing statement, identifying the 1–2 most critical unresolved questions or assumptions the founder must validate. These are three more debate messages (one per agent), shown like Rounds 1 and 2.

*After Round 3 — Map Synthesis (separate call)*
Once all three closing statements are in, a **separate, single** Gemini call (`POST /api/war-room/assumptions`) takes the **entire** transcript (Rounds 1–3) and produces the Assumption Map as structured JSON. This is not a per-agent debate turn — it is one synthesis pass over the whole debate, run with low temperature for deterministic JSON. The orchestration sequence is therefore: Round 1 (×3) → Round 2 (×3) → Round 3 closings (×3) → assumptions synthesis (×1).

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

**UX during debate:** Each agent's full response appears after a loading state — not streamed. Messages are labeled with agent name and round number. The founder watches the debate unfold sequentially. The map-synthesis call runs after the Round 3 closings, behind its own loading state, before the view transitions to the Assumption Map.

Each debate turn is a separate Gemini API call, as is the final map synthesis. Full transcript-so-far is passed as context into each subsequent call.

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

**Visual reference:** `frontend/inspo.html` is the primary design inspiration for the War Room. Open it in a browser. **The War Room session UI (Phases 6–7) MUST visually match inspo.html — not approximate it. If in doubt, open inspo.html and compare side-by-side.**

Key elements that must be replicated precisely:
- **Arena layout** — the three agents are positioned spatially around a central oval "debate floor" (Skeptic top, Strategist left, Operator right, Founder at bottom). This is not a linear chat layout — it reads as a room.
- **Warm session background**: The inspo uses `#0f0e0c` (warm brownish black) as the War Room session page background — warmer/browner than the app-wide `#0a0a0f`. Use `var(--war-room-bg)` on the session page.
- **Arena ellipse**: Outer ellipse fill `#241f19` / stroke `#322b24`. Inner guide ellipse (no fill) stroke `#3a332b`. These are `var(--arena-fill)` / `var(--arena-stroke)` / `var(--arena-inner-stroke)` in globals.css.
- **Agent circles**: Circular stroke rings, no avatars. Use the arena stroke colors — NOT the app-wide accent colors — for the circle rings in the arena layout:
  - Skeptic ring: `var(--arena-skeptic-stroke)` `#c2692a` (warm orange, not `#ef4444`)
  - Strategist ring: `var(--arena-strategist-stroke)` `#5a7db0` (muted blue)
  - Operator ring: `var(--arena-operator-stroke)` `#4a7c59` (muted green)
  - Founder ring: `var(--arena-founder-stroke)` `#a8987f` (warm tan)
  - Fill: `rgba(color, 0.15–0.20)` tint inside each ring
- **Agent accent colors vs. arena stroke colors**: The app-wide accent colors (`#ef4444`, `#3b82f6`, `#22c55e`) are used for text labels, message borders, and node status colors throughout the app. The arena stroke colors above are only for the spatial circle nodes in the arena layout.
- **"War Room" typography**: Spectral serif italic, color `#ede9e0` (`var(--arena-text)`), centered over the oval. Use `font-serif italic` (Spectral, via `--font-serif`).
- **Serif italic "War Room" typography** for the session header — gives it a gravitas/editorial feel distinct from the rest of the app's sans-serif UI (Hanken Grotesk)

The debate transcript (chat view during rounds) transitions into the arena/map view after Round 3 completes.

**Overall vibe:** Dark, warm, editorial "situation room" — confident, literary, dense but calm. Not generic SaaS-dark, not neon cyberpunk. Think a dimly lit walnut roundtable with one overhead light.

**Color system** *(as implemented — warm design-system palette):*
- Background: `#0f0e0c` (warm brownish-black, with radial gradient `#14120f → #0f0e0c`)
- Surface/card: `#131210` (`--surface-1`); elevated: `#1a1916` (`--surface-3`)
- Border: `#2e2c28`; strong: `#38332b`; warm: `#4a443a`
- Text primary: `#ede9e0` (warm off-white — never pure `#fff`)
- Text secondary: `#7a7670`; dim: `#5a574f`
- Skeptic: `#c2692a` (burnt orange) — structural/rings use this, text/labels same
- Strategist: `#6f93c4` (slate blue text tint); structural base `#3a5a8a`
- Operator: `#6fa37e` (forest green text tint); structural base `#4a7c59`

> **Note:** The older cool-tone values (`#0a0a0f`, `#ef4444`, `#3b82f6`, `#22c55e`) were replaced in the Phase 3 design-system refresh (2026-06-18) — see `.claude/LOG.md`. The current source of truth is `globals.css` `:root` block.

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

## Design Skills & Priority Hierarchy

Three design skills are active in this project. When instructions conflict, follow this priority order — higher number wins:

1. `frontend-design` (global) — Anthropic's official skill. Sets creative direction and aesthetic thinking. Prevents generic AI-looking output. Apply before writing any UI code.
2. `ui-ux-pro-max` (global) — Community skill. Reference library for styles, color palettes, font pairings, and UX guidelines. Use when making design decisions that aren't covered by the project design system.
3. `design-system` (project-level, `.claude/design/FOUNDR_UI_SKILL.md`) — THIS PROJECT'S source of truth. Contains the exact color tokens, typography, spacing, and component patterns for this app. Always wins conflicts with the two global skills above.

### In practice
- **Before writing any UI component:** read `.claude/design/FOUNDR_UI_SKILL.md` for the canonical color tokens, typography, spacing, and component patterns.
- Start with `frontend-design` thinking (purpose, tone, differentiation) before writing any component.
- Pull from `ui-ux-pro-max` for style/palette decisions not specified in the project design system.
- Always defer to the project `design-system` skill for any token, color, font, or component pattern — never invent values.

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
├── lib/
│   └── gemini.ts                       # All Gemini API calls
├── components/
│   ├── war-room/
│   │   ├── Questionnaire.tsx
│   │   ├── DebateTranscript.tsx
│   │   └── AssumptionMap.tsx           # React Flow node graph
│   ├── Sidebar.tsx
│   └── ui/                             # shadcn components
└── prompts/
    └── agents.ts                       # All system prompts as named constants

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

## Project Phases

> These phases are sequential. Within a phase, some steps can parallelize.
> Scope: War Room feature only. Launchpad and Pitch Coach are placeholder shells until Phase 8.

### Phase 0 — Groundwork & Verification
- [x] Read Next 16 App Router changes, fix `tsconfig.json` path aliases
- [x] Move `frontend/ui/button.tsx` → `frontend/components/ui/button.tsx`
- [x] Create `frontend/.env.local` (`GEMINI_API_KEY`, `NEXT_PUBLIC_BACKEND_URL`)
- [x] Create `backend/.env` (`DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`)
- [x] Add `.env.example` for both, confirm both are gitignored

### Phase 1 — Database / Prisma
- [x] Add `url = env("DATABASE_URL")` to datasource block in `schema.prisma`
- [x] Add `WarRoomSession`, `DebateMessage`, `AssumptionNode` models + enums (`SessionStatus`, `AgentRole`, `NodeStatus`)
- [x] Add `sessions WarRoomSession[]` back-relation to `User`
- [ ] Run `prisma generate` + `prisma migrate dev --name war_room_models` *(generate done; migrate pending live DB)*

### Phase 2 — Backend Scaffolding (Express)
- [x] Fix broken error handler in `backend/src/index.ts`, move it after routes
- [x] Apply `checkJwt` to `/v1/auth` and `/v1/sessions`
- [x] Create session router skeleton in `backend/src/v1/sessions/index.ts`, mount it
- [x] Add `requireUser` helper (resolve local `User` from `req.auth.payload.sub`)
- [x] Implement `POST /v1/sessions` — create session, return id
- [x] Implement `GET /v1/sessions/:id` — return session + transcript + assumptions, owner-checked
- [x] Implement `PATCH /v1/sessions/:id` — persist canvas, status, bulk-write messages/nodes
- [ ] Smoke test all endpoints with a token before touching frontend *(pending live DB)*

### Phase 3 — Frontend Shell (no AI yet)
- [x] Install deps: `@xyflow/react`, `framer-motion`, `@google/genai`, shadcn primitives
- [x] Apply design tokens to `globals.css` + Tailwind theme *(warm palette applied in post-Phase-3 refresh — see `.claude/LOG.md`; current bg `#0f0e0c`, agent accents `#c2692a`/`#6f93c4`/`#6fa37e`)*
- [x] Build app layout: narrow left sidebar + wide main panel in `app/layout.tsx`
- [x] Build `app/page.tsx` landing/onboarding
- [x] Create placeholder pages: `app/launchpad/page.tsx`, `app/pitch-coach/page.tsx`
- [x] Create empty route files: `app/war-room/page.tsx`, `app/war-room/session/[id]/page.tsx`

### Phase 4 — Gemini Service & Prompts
- [x] Write `frontend/prompts/agents.ts` — all system prompts as named constants (SKEPTIC, STRATEGIST, OPERATOR; question-gen; round 2/3; assumption-map JSON). No inline prompts anywhere else.
- [x] Write `frontend/lib/gemini.ts` — typed `callGemini(prompt, context)` + JSON-parsing helper, non-streaming
- [x] Build + test `app/api/war-room/questions/route.ts`
- [x] Build + test `app/api/war-room/debate/route.ts`
- [x] Build + test `app/api/war-room/assumptions/route.ts`

### Phase 5 — War Room: Idea Intake
- [ ] Build `components/war-room/Questionnaire.tsx` — one-liner → 3 AI questions + 5 defaults = 8 question form
- [ ] Wire submit: `POST /v1/sessions` to persist, route to `/war-room/session/[id]`

### ⚠️ Before Phase 6 — Open inspo.html in a browser
The War Room session UI **must** match `frontend/inspo.html` visually. Read the "Visual reference" section in UI/UX Direction above for the exact color tokens and layout constraints. Do not approximate — compare side-by-side. All arena-specific CSS variables are already in `globals.css`.

### Phase 6 — War Room: The Debate
- [ ] Build `components/war-room/DebateTranscript.tsx` — agent avatars, accent borders, typing indicators, Framer Motion reveal
- [ ] Build orchestration hook: Round 1 (×3 agents) → Round 2 (×3) → Round 3 closings (×3) → assumptions synthesis (×1, `POST /api/war-room/assumptions`), each step gated by its own loading state. The round builders slice the transcript internally, so pass the full transcript-so-far to every call.
- [ ] Persist transcript via `PATCH /v1/sessions/:id` as rounds complete

### Phase 7 — War Room: Assumption Map
- [ ] Build `components/war-room/AssumptionMap.tsx` — React Flow, color-coded by status, sized by risk, network layout
- [ ] Build node side-panel: claim + explanation + agent reasoning + validate/modify/remove form
- [ ] Wire remediation: update node status on canvas, `PATCH` canvas JSON
- [ ] Add Responsible AI disclaimer banner + "→ Launchpad" CTA

### Phase 8 — Polish & Ship
- [ ] End-to-end pass: intake → debate → map → remediate → canvas persisted
- [ ] Verify: no raw JSON shown, every AI call has loading state, no localStorage/sessionStorage used
- [ ] Confirm GitHub Actions smart-deploy picks up frontend + backend changes
- [ ] Deploy to `usaii.darkermine.dev`, run full demo flow on server

## Current Status
> Update this after each phase completes.

- [x] Phase 0
- [x] Phase 1 *(migration pending live DB)*
- [x] Phase 2 *(smoke test pending live DB)*
- [x] Phase 3
- [x] Phase 4
- [ ] Phase 5
- [ ] Phase 6
- [ ] Phase 7
- [ ] Phase 8

> **Next task:** Phase 5 — Idea Intake
> 1. Build `components/war-room/Questionnaire.tsx` — one-liner → calls `/api/war-room/questions`, renders 3 AI questions + 5 defaults = 8-question form.
> 2. Wire submit: `POST /v1/sessions` to persist session, route to `/war-room/session/[id]`.
> Backend + DB required — run `prisma migrate dev` against a live DB first.

