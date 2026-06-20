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

## The Three Pillars

### War Room
The core feature. The founder describes their idea, answers a short questionnaire, and watches three AI advisors debate it in structured rounds:

- **Round 1 — Opening Statements:** Each agent reads the questionnaire independently and surfaces 1–2 key concerns
- **Round 2 — Rebuttals:** Agents respond to each other's points. Genuine disagreement is expected and intentional
- **Round 3 — Closing Statements:** Each agent names the 1–2 most critical unresolved assumptions the founder must validate

After Round 3, a separate synthesis pass produces the **Assumption Map** — a visual canvas of every claim extracted from the debate, color-coded by status (VALIDATED / UNVALIDATED / NEEDS_INFO) and sized by risk.

**Why three agents?** A single AI response produces false consensus. The multi-agent structure forces the model to reason from genuinely different frames — market skepticism, operational realism, strategic positioning — so the output reflects real tradeoff tension, not a sanitized summary.

### Launchpad
Where founders stop thinking and start doing. Agents read directly from the War Room's Assumption Map:

- **Customer Connect** — drafts personalized outreach targeting the most critical unvalidated assumption. The founder reviews and sends every message manually. The AI never contacts anyone on their behalf.
- **Executive Summary** — synthesizes the map into a one-page brief, surfacing key risks directly from the assumption map rather than softening them.

### Pitch Session
Live AI pitch coach powered by Gemini multimodal. Analyzes delivery, pacing, filler words, and slide clarity in real time. Flags when a verbal pitch contradicts unvalidated assumptions from the War Room.

---

## AI Architecture

| Stage | Input | AI Capability | Output |
|---|---|---|---|
| Question generation | Founder's idea summary | LLM (Gemini 3.1 Flash-Lite) with domain-aware prompting | 3 tailored questions specific to the idea's risks |
| Debate — Round 1 | Questionnaire responses | 3 parallel LLM calls with distinct system prompts (Skeptic / Strategist / Operator) | 3 independent opening statements |
| Debate — Round 2 | Full Round 1 transcript | LLM with full context | 3 cross-agent rebuttals |
| Debate — Round 3 | Rounds 1–2 transcript | LLM with full context | 3 closing statements naming critical unknowns |
| Assumption synthesis | Full 9-turn transcript | LLM at low temperature (structured extraction) | Structured JSON: claim, status, explanation, agentSource, howToTest |
| Launchpad — Outreach | Assumption Map canvas | LLM with canvas context | Personalized cold outreach targeting the riskiest unvalidated assumption |
| Launchpad — Summary | Assumption Map canvas | LLM with canvas context | One-page executive brief with risks surfaced from the map |
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

**Human-in-the-Loop (two explicit control points):**

1. **Assumption Map remediation** — the AI surfaces nodes; the founder decides what to do with each one. Validate, modify, or remove — every status change requires the founder to act. The AI never auto-resolves a node.
2. **Customer outreach** — the AI drafts messages; the founder reviews and sends every one manually. The system has no send capability by design.

The founder is never told whether their idea is worth pursuing. The AI presents evidence. The founder decides.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Node graph | React Flow (Assumption Map) |
| Animation | Framer Motion |
| Primary AI | Gemini 3.1 Flash-Lite (Google AI Studio) |
| Fallback AI | Groq Qwen3-32B |
| Live AI (Pitch Session) | Gemini Live multimodal |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL via Prisma 7 (Neon) |
| Auth | Auth0 v4 (`@auth0/nextjs-auth0`) |
| Deployment | EC2 · PM2 · GitHub Actions (smart deploy) |

---

## Project Structure

```
launchify/
├── frontend/               # Next.js 16 App Router
│   ├── app/                # Pages and layouts
│   ├── actions/            # Server Actions (replaces API routes)
│   │   ├── sessions.ts     # Session CRUD
│   │   ├── war-room.ts     # Debate + assumption generation
│   │   ├── launchpad.ts    # Outreach + summary generation
│   │   └── gemini.ts       # Live API token
│   ├── components/
│   │   ├── war-room/       # Questionnaire, Arena, Assumption Map
│   │   ├── launchpad/      # Launchpad client
│   │   ├── pitch-session/  # Live pitch session UI
│   │   └── home/           # Session list
│   ├── lib/                # LLM provider layer, Auth0, backend proxy
│   └── prompts/            # All system prompts as named constants
└── backend/                # Express 5 + Prisma
    ├── src/v1/sessions/    # Session CRUD + canvas persistence
    └── prisma/             # Schema with cascade deletes
```

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

When the founder validates a node, the map updates in real time. The Launchpad reads the current map state before every generation — so outreach and summaries are always calibrated to what's actually been validated, not the original pitch.

---

## Team

| Person | Role |
|---|---|
| Eric | Frontend, AI orchestration, system prompts |
| Ben | Backend, database, API endpoints |
| Elaine | Product vision, direction |

---

*Built for USAII Global AI Hackathon 2026 · Challenge Brief 3 · Direction B*
*Live demo: [usaii.darkermine.dev](https://usaii.darkermine.dev)*
