# Launchify — AI Startup Co-Pilot

> Built for the USAII Global AI Hackathon 2026 · Challenge Brief 3 · Direction B (Zero-to-One Builder)

Launchify helps early-stage founders stress-test their startup idea through a structured multi-agent debate before the market does. Three AI advisors — Skeptic, Strategist, and Operator — challenge assumptions from different angles, producing an interactive Assumption Map the founder uses to plan validation.

## Features

- **War Room** — Submit your idea, answer 8 tailored questions, then watch three AI agents debate it across 3 rounds. Output is a structured Assumption Map.
- **Assumption Map** — Color-coded React Flow canvas. Founders remediate each node (validate / modify / remove). The AI surfaces uncertainty; the founder decides what to do with it.
- **Launchpad** — Agent workspace that reads from your Assumption Map to generate outreach drafts, market research, and validation plans.
- **Pitch Coach** — Gemini multimodal pitch analysis (UI shell, not yet built).

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Graph | React Flow (`@xyflow/react`) |
| Animation | Framer Motion |
| AI | Gemini 2.0 Flash-Lite (primary), Groq Qwen3-32B (fallback) |
| Auth | Auth0 (`@auth0/nextjs-auth0` v4) |
| Backend | Express 5, Prisma 7, PostgreSQL |
| Hosting | usaii.darkermine.dev (nginx, PM2, GitHub Actions CI/CD) |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local Postgres)
- Auth0 account with a Regular Web App + API configured

### Local dev

```bash
# Start the database
docker start foundr-db
# or first-time setup:
docker run -d --name foundr-db -e POSTGRES_USER=foundr -e POSTGRES_PASSWORD=foundr -e POSTGRES_DB=foundr -p 5432:5432 postgres:16-alpine

# Install and run the frontend
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy `.env.example` to `.env.local` (frontend) and `.env` (backend) and fill in:

**`frontend/.env.local`**
```
AUTH0_SECRET=<openssl rand -hex 32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<your-auth0-domain>
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_AUDIENCE=<your-api-identifier>
AUTH0_SCOPE=openid profile email
GEMINI_API_KEY=<your-gemini-key>
GROQ_API_KEY=<your-groq-key>
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

**`backend/.env`**
```
DATABASE_URL=postgresql://foundr:foundr@localhost:5432/foundr
AUTH0_DOMAIN=<your-auth0-domain>
AUTH0_AUDIENCE=<your-api-identifier>
```

### Auth0 setup

1. Create a Regular Web App. Set callback to `http://localhost:3000/auth/callback`, logout to `http://localhost:3000`.
2. Create an API (identifier = `AUTH0_AUDIENCE`).
3. Add a Login flow Action that sets custom claims on the access token:
   ```js
   event.accessToken.setCustomClaim('email', event.user.email);
   event.accessToken.setCustomClaim('name', event.user.name);
   event.accessToken.setCustomClaim('picture', event.user.picture);
   ```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/war-room/       # LLM endpoints (questions, debate, assumptions)
│   ├── war-room/           # Idea intake + debate session
│   ├── launchpad/          # Agent workspace
│   └── pitch-session/      # Placeholder
├── components/
│   ├── war-room/           # WarRoomArena, AssumptionMap, Questionnaire
│   ├── launchpad/          # LaunchpadClient
│   └── ui/                 # shadcn/ui primitives
├── lib/                    # LLM provider layer, auth, types, utils
├── prompts/agents.ts       # All system prompts (single source of truth)
└── actions/                # Server actions for backend calls

backend/
├── src/
│   ├── v1/sessions/        # CRUD for WarRoomSession + canvas updates
│   └── v1/auth/            # Auth0 user sync
└── prisma/schema.prisma
```

## Responsible AI

Launchify is designed so the AI reasons, not decides:

- **No verdicts** — the AI never says whether an idea is good or bad. It surfaces assumptions and uncertainty.
- **Founder remediates** — every assumption node is resolved by the founder, not the AI.
- **Uncertainty-first map** — UNVALIDATED nodes are visually louder than VALIDATED ones.
- **Manual outreach only** — the AI drafts messages; the founder reviews and sends every one manually.
- **Persistent disclaimer** — "This analysis is based entirely on what you told us. It does not replace talking to real customers."

## Team

| Person | Role |
|---|---|
| Eric | Frontend, agent orchestration, system prompts |
| Ben | Backend, Prisma, database, API |
| Elaine | Product vision |
