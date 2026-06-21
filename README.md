# Launchify — AI Startup Co-Pilot

> **USAII Global AI Hackathon 2026** · Undergraduate Track · Challenge Brief 3 · Direction B: Zero-to-One Builder
> Build window: June 14–21, 2026

---

## What We're Building

Launchify is an AI-powered startup co-pilot that helps aspiring founders move from a vague idea to a structured, stress-tested execution plan. It is built for the **Second Brain** challenge — specifically **Direction B (Zero-to-One Builder)** — because it solves the exact problem the brief names: most tools either oversimplify or overwhelm. Launchify sits in the middle, using AI to help founders *reason*, not just retrieve or generate content.

**The guiding principle:** Launchify surfaces information. The founder decides what to do with it.

---

## The Problem

Early-stage founders face three compounding problems:

1. **Idea fog** — they can't clearly articulate what they're building or who it's for
2. **Hidden assumptions** — they don't know what they don't know, so they build on unvalidated beliefs
3. **Stalled execution** — without a structured first step, momentum dies before anything ships

Most tools generate lists. Launchify generates *reasoning* — through a structured multi-agent debate that surfaces what's actually unproven, then turns that into an actionable map of what to validate next.

---

## How It Fits the Second Brain Category

The challenge brief defines a Second Brain as a tool that helps people **process complexity, understand tradeoffs, and move from uncertainty to meaningful action**. Launchify hits all three directly:

| Second Brain Requirement | How Launchify Delivers |
|---|---|
| Process complexity | Three AI agents debate the founder's idea from opposing angles — Skeptic, Strategist, Operator — so no single viewpoint dominates |
| Understand tradeoffs | The Assumption Map visualizes what's validated vs. unvalidated, sized by risk — so founders see *where the danger is*, not just a list of concerns |
| Move from uncertainty to action | Every unvalidated node surfaces a concrete `howToTest` step; the Launchpad drafts the first outreach and executive summary directly from the map |

Direction B asks for: *vague idea → structured plan → first real step*. That is precisely the pipeline:

```
Idea intake → Questionnaire → AI Debate (3 rounds × 3 agents) → Assumption Map → Launchpad outreach + summary
```

---

## The Four Pillars

### War Room
The core feature. The founder describes their idea, answers a short questionnaire, and watches three AI advisors debate it in structured rounds:

- **Round 1 — Opening Statements:** Each agent reads the questionnaire independently and surfaces 1–2 key concerns
- **Round 2 — Rebuttals:** Agents respond to each other's points. Genuine disagreement is expected and intentional
- **Round 3 — Closing Statements:** Each agent names the 1–2 most critical unresolved assumptions the founder must validate

After Round 3, a separate synthesis pass produces the **Assumption Map** — a visual canvas of every claim extracted from the debate, color-coded by status (VALIDATED / UNVALIDATED / NEEDS_INFO) and sized by risk.

**Why three agents?** A single AI response produces false consensus. The multi-agent structure forces the model to reason from genuinely different frames — market skepticism, operational realism, strategic positioning — so the output reflects real tradeoff tension, not a sanitized summary.

**Session persistence:** War Room sessions are saved to the database and listed on the home screen with status badges (In Progress / Complete). Sessions can be deleted with a confirmation step.

### Launchpad
Where founders stop thinking and start doing. Agents read directly from the War Room's Assumption Map. Five output tabs:

- **Customer Connect** — drafts personalized outreach targeting the most critical unvalidated assumption, including email subject/body, LinkedIn message, target profile rationale, and personalization tips. The founder reviews and sends every message manually. The AI never contacts anyone on their behalf.
- **Executive Summary** — synthesizes the map into a one-page brief surfacing key risks, validated signals, and concrete next steps.
- **Validation Roadmap** — generates a week-by-week milestone plan with the single cheapest test to run first, success/fail signals per milestone, and a risk warning.
- **Market Research** — surfaces competitive landscape, timing signals, and differentiation hypothesis from the assumption map context, with explicit flags on things the founder must verify independently.
- **Founder's Log** — a private scratchpad for per-output context notes and free-form session journaling, persisted to the database.

### Strategy Room
An AI advisor with full context of the founder's idea and assumption canvas. The advisor reads:

- The War Room canvas (all assumption nodes with status and explanations)
- Any documents the founder uploads (PDF, up to 20 MB)

Documents are chunked, stored in S3, and indexed with pgvector embeddings for retrieval. The advisor uses the retrieved context to answer questions about the idea, market, or next move. Session picker lets founders switch between War Room sessions.

### Pitch Session
Live AI pitch coach powered by Gemini Live multimodal. Connects via WebSocket to the Gemini Live API and analyzes the founder's pitch in real time:

- Mic input with mute/unmute toggle
- Camera feed with draggable, resizable overlay (sm / md / lg)
- Screen share support
- Real-time feedback log with timestamps and round tracking
- Feedback panel toggleable alongside the live session

---

## AI Architecture

| Stage | Input | AI Capability | Output |
|---|---|---|---|
| Question generation | Founder's idea summary | LLM (Gemini Flash) with domain-aware prompting | 3 tailored questions specific to the idea's risks |
| Debate — Round 1 | Questionnaire responses | 3 parallel LLM calls with distinct system prompts (Skeptic / Strategist / Operator) | 3 independent opening statements |
| Debate — Round 2 | Full Round 1 transcript | LLM with full context | 3 cross-agent rebuttals |
| Debate — Round 3 | Rounds 1–2 transcript | LLM with full context | 3 closing statements naming critical unknowns |
| Assumption synthesis | Full 9-turn transcript | LLM at low temperature (structured extraction) | Structured JSON: claim, status, explanation, agentSource, howToTest |
| Launchpad — Customer Connect | Assumption Map canvas + user context | LLM with canvas context | Email, LinkedIn message, target profile, personalization tips |
| Launchpad — Executive Summary | Assumption Map canvas + user context | LLM with canvas context | One-page brief with risks, validated signals, next steps |
| Launchpad — Validation Roadmap | Assumption Map canvas + user context | LLM with canvas context | Week-by-week milestones with cheapest test and risk warning |
| Launchpad — Market Research | Assumption Map canvas + user context | LLM with canvas context | Competitor landscape, timing signals, differentiation hypothesis |
| Strategy Room | Canvas + uploaded docs (pgvector retrieval) | LLM with RAG context | Answers about idea, market, and next moves |
| Pitch Session | Live audio + camera + screen | Gemini Live multimodal | Real-time coaching feedback on delivery and content |

**Why an LLM and not a rules engine?**

Extracting implicit assumptions from freeform founder text, classifying them contextually as validated vs. unvalidated vs. needs-info, generating domain-appropriate validation paths, and reasoning across a multi-turn agent debate requires language understanding that rules cannot replicate. A rules engine could check for keywords. It cannot notice that a founder's confident claim about market size contradicts a vague answer about customer conversations — and name that tension clearly.

---

## Responsible AI

**Risk: False Confidence**

The War Room produces structured, authoritative-looking output. Founders may mistake this for validation. It is not — the analysis is based entirely on what the founder told the system.

**Mitigation (visible in the product):**
- UNVALIDATED and NEEDS_INFO nodes are visually louder than VALIDATED nodes on the map — larger, higher-contrast, foregrounded. The map never reads as a "your idea is validated" trophy.
- Every node's side panel states: *"This status was AI-inferred from only what you told us. Verify before trusting it."*
- A persistent disclaimer banner on the results screen: *"This analysis is based entirely on what you've told us. It does not replace talking to real customers."*
- Market Research output explicitly flags every unverified claim for the founder to confirm independently.

**Human-in-the-Loop (explicit control points):**

1. **Assumption Map remediation** — the AI surfaces nodes; the founder decides what to do with each one. Validate, modify, or remove — every status change requires the founder to act. The AI never auto-resolves a node.
2. **Customer outreach** — the AI drafts messages; the founder reviews and sends every one manually. The system has no send capability by design.
3. **Document context** — the Strategy Room advisor only retrieves documents the founder explicitly uploaded to their own session.

The founder is never told whether their idea is worth pursuing. The AI presents evidence. The founder decides.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Node graph | React Flow / @xyflow/react (Assumption Map) |
| Animation | Framer Motion |
| 3D background | Three.js |
| Primary AI | Gemini Flash (Google AI Studio) |
| Fallback AI | Groq Qwen3-32B |
| Live AI (Pitch Session) | Gemini Live multimodal (WebSocket) |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL via Prisma 6 (Neon) + pgvector |
| Document storage | AWS S3 |
| Auth | Auth0 v4 (`@auth0/nextjs-auth0`) + JWT bearer middleware |
| Validation | Zod |
| Deployment | EC2 · PM2 · nginx (brotli, caching, security headers) · GitHub Actions |
| PWA / SEO | Web manifest, sitemap, robots.txt, OG image, apple-icon, favicon |

---

## Project Structure

```
launchify/
├── frontend/               # Next.js 15 App Router
│   ├── app/                # Pages and layouts
│   │   ├── page.tsx                      # Home: session list + pillars grid
│   │   ├── war-room/                     # War Room flow
│   │   │   ├── page.tsx                  # New session intake
│   │   │   └── session/[id]/page.tsx     # Active session (debate + map)
│   │   ├── launchpad/page.tsx            # Launchpad (5 output tabs)
│   │   ├── strategy-room/page.tsx        # Strategy Room advisor
│   │   ├── pitch-session/page.tsx        # Gemini Live pitch coach
│   │   ├── icon/route.tsx                # Favicon generation (Satori)
│   │   ├── opengraph-image.tsx           # OG image generation (Satori)
│   │   ├── apple-icon.tsx                # Apple touch icon
│   │   ├── manifest.ts                   # PWA manifest
│   │   ├── sitemap.ts                    # Dynamic sitemap
│   │   └── robots.ts                     # robots.txt
│   ├── actions/            # Server Actions (replaces API routes)
│   │   ├── sessions.ts     # Session CRUD + launchpad result persistence
│   │   ├── war-room.ts     # Debate + assumption generation
│   │   ├── launchpad.ts    # Outreach, summary, roadmap, market research
│   │   ├── advisor.ts      # Strategy Room chat + document upload
│   │   ├── profile.ts      # User profile update + password reset
│   │   └── gemini.ts       # Gemini Live API token
│   ├── components/
│   │   ├── war-room/       # Questionnaire, Arena, Assumption Map
│   │   ├── launchpad/      # Launchpad 5-tab client
│   │   ├── strategy-room/  # Advisor chat, document panel, session picker
│   │   ├── pitch-session/  # Live session UI with camera/screen overlay
│   │   ├── home/           # Session list with status + delete
│   │   ├── landing/        # Marketing landing page (unauthenticated)
│   │   ├── sidebar.tsx     # Nav sidebar with user settings
│   │   ├── mobile-nav.tsx  # Bottom nav for mobile
│   │   └── user-settings-dialog.tsx  # Profile + security settings modal
│   ├── lib/                # LLM provider layer, Auth0, backend proxy, types
│   └── prompts/            # All system prompts + user context injection
└── backend/                # Express 5 + Prisma
    ├── src/v1/
    │   ├── sessions/       # Session CRUD + canvas + launchpad persistence
    │   ├── advisor/        # Chat history + S3 document upload + PDF chunking
    │   ├── users/          # User profile endpoint (/v1/users/me)
    │   └── auth/           # Auth0 account sync (upsert on login)
    └── prisma/             # Schema with cascade deletes + pgvector index
```

---

## Database Schema

```
User                  — Auth0-linked account (email, name, picture, provider)
WarRoomSession        — Core session (idea, questionnaire, canvas, launchpad outputs)
DebateMessage         — 9-turn debate transcript (agent × round)
AssumptionNode        — Extracted claims with status, explanation, howToTest
AdvisorMessage        — Strategy Room chat history (USER / ASSISTANT)
SessionDocument       — Uploaded PDFs (S3 key, filename)
DocumentChunk         — Chunked PDF text with pgvector embeddings for RAG
```

All child records cascade-delete when a session is deleted.

---

## The Assumption Map

The Assumption Map is the living document that powers the entire application. After the debate, every claim extracted from the 9-turn transcript is stored as a node:

```json
{
  "id": "node_001",
  "claim": "Freight brokers spend >2 hours per day on carrier outreach emails",
  "status": "UNVALIDATED",
  "agentSource": "SKEPTIC",
  "explanation": "No evidence was provided. This is the core utilization assumption.",
  "howToTest": "Interview 5 freight brokers and time-track their email activity for one week.",
  "remediation": null
}
```

When the founder validates a node, the map updates in real time. The Launchpad reads the current map state before every generation — so outreach and summaries are always calibrated to what's actually been validated, not the original pitch. The canvas persists to the database automatically after every change.

---

## Auth & User Accounts

- Auth0 v4 with support for Email/Password, Google OAuth2, and GitHub OAuth
- Account sync endpoint upserts user records on every login
- User Settings dialog with Profile tab (display name) and Security tab (password reset email for `auth0|` accounts)
- Auth provider detection — social login accounts show their provider and cannot trigger a password reset
- JWT bearer middleware on all backend routes validates Auth0 tokens

---

## Team

| Person | Role |
|---|---|
| Eric | Frontend, AI orchestration, system prompts |
| Ben | Backend, database, API endpoints |
| Elaine | Product vision, direction |

---

*Built for USAII Global AI Hackathon 2026 · Challenge Brief 3 · Direction B*
*Live demo: [launchify.darkermine.dev](https://launchify.darkermine.dev)*
