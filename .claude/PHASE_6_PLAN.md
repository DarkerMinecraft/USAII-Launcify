# Phase 6 — The War Room Debate (Arena Roundtable)

> Standalone implementation plan. Read `frontend/CLAUDE.md` + `.claude/LOG.md` first for full
> project state. This plan is self-contained enough to execute after a context clear.

## Context
FOUNDR's War Room is complete through Idea Intake (Phases 0–5): a founder submits an idea,
answers the 8-question form, `POST /api/sessions` creates a `WarRoomSession`, and redirects to
`/war-room/session/[id]` — which today is only a placeholder shell.

Phase 6 makes that session page run the actual **3-round, 3-agent debate** and is the
hackathon's core differentiator (the multi-agent debate is the "why an LLM, not a rules engine"
answer). The LLM API routes already exist and are tested; what's missing is the **client
orchestration + arena UI** that drives them in sequence, reveals each agent's turn, runs the
final synthesis, and persists everything to the DB through a new BFF route.

**Layout decision (confirmed by user): arena roundtable per `inspo.html`** — agents around a
central oval debate floor, speech bubble for the active speaker, cross-fading to the Phase 7
map. Must *match* inspo.html, not approximate (open it side-by-side while building).

## Reuse — do not rebuild
- `POST /api/war-room/debate` → `{ agent, round, content }`; pass full transcript, it slices internally per round.
- `POST /api/war-room/assumptions` → `{ assumptions, dropped }`; returns sanitized canonical nodes with `id`s + `remediation:null`.
- `lib/types.ts` — `AgentRole`, `DebateMessage`, `AssumptionNode`, `Canvas`, `QA`.
- `lib/backend.ts` — `forwardToBackend()` + `ensureUserSynced()`.
- `app/api/sessions/route.ts` — the POST BFF whose error contract (400/401/502) the new GET/PATCH must mirror.
- Backend `PATCH /v1/sessions/:id` — accepts `{ canvas?, status?, messages?, assumptions? }`, fully idempotent (createMany skipDuplicates on `@@unique([sessionId,agent,round])`; assumptions delete-then-recreate).
- Tokens in `globals.css` (arena oval/agent/founder colors, `--war-room-bg`), `thinkDot`/`softFloat` keyframes; component recipes in `.claude/design/FOUNDR_UI_SKILL.md` (speech bubble, avatar, round stepper, typing pill).

## Arena geometry (exact, from inspo.html — SVG `viewBox="0 0 1200 800"`)
- Outer oval: `cx600 cy430 rx300 ry190` fill `#241f19` stroke `#322b24` w3.
- Inner guide oval: `rx250 ry150` fill none stroke `#3a332b` w1.5.
- "War Room" — Spectral italic, `#ede9e0`, centered over the oval.
- Agent nodes (circle r34, stroke-width 5, fill = ring color at low alpha):
  - **Skeptic** top `(600,190)` stroke `#c2692a` fill `rgba(194,105,42,0.15)`
  - **Strategist** left `(250,430)` stroke `#5a7db0` fill `rgba(58,90,138,0.18)`
  - **Operator** right `(950,430)` stroke `#4a7c59` fill `rgba(74,124,89,0.18)`
  - **Founder** bottom `(600,660)` r38 stroke `#a8987f` fill `rgba(138,122,106,0.2)`
- Page background `var(--war-room-bg)`; one soft overhead radial glow over the table.

## Implementation

### 1. BFF route — `frontend/app/api/sessions/[id]/route.ts` (new)
`GET` and `PATCH`, mirroring `app/api/sessions/route.ts` exactly (`ensureUserSynced()` →
`forwardToBackend()`; map `BackendAuthError`→401, `BackendError`→502, bad JSON→400).
Next 16: params is a Promise — `const { id } = await ctx.params`.
- `GET` → forwards `GET /v1/sessions/${id}`; returns the session (ideaSummary,
  questionnaireResponses, canvas, status, transcript[], assumptions[]).
- `PATCH` → validates body is an object, forwards `PATCH /v1/sessions/${id}` with
  `{ canvas?, status?, messages?, assumptions? }`.

### 2. Session page — `frontend/app/war-room/session/[id]/page.tsx` (replace placeholder)
Server component. `await params`; gate with `auth0.getSession()` reusing the sign-in-prompt
pattern from `app/war-room/page.tsx`. When authed, render client `<WarRoomArena id={id} />`.
(Initial session fetch happens client-side via the BFF GET — keeps all token use in route
handlers, per the `lib/backend.ts` "not from a Server Component" note.)

### 3. Arena + orchestration — `frontend/components/war-room/WarRoomArena.tsx` (new, client)
State machine: `loading → debating → synthesizing → ready` (+ `error`).
- **Load:** on mount `GET /api/sessions/[id]`; pull ideaSummary, questionnaireResponses,
  existing transcript. Loading/error states (no streaming).
- **Resume:** derive completed `(agent,round)` pairs from the fetched transcript; start at the
  next step. If 9 messages already exist (status `COMPLETE` / assumptions present) jump to `ready`.
- **Orchestrate:** iterate `DEBATE_STEPS = [{R1:SK,ST,OP},{R2:…},{R3:…}]` (9 turns). Each turn:
  mark that agent active + thinking → `POST /api/war-room/debate` with the **full
  transcript-so-far** → append the returned message → reveal its bubble. After every round (3
  turns) `PATCH /api/sessions/[id]` `{ messages: thisRound }` (idempotent).
- **Synthesize:** after turn 9, `synthesizing` state → `POST /api/war-room/assumptions` with the
  full transcript → build `Canvas { ideaSummary, questionnaireResponses, assumptions, lastUpdated }`
  → `PATCH { canvas, assumptions, status:"COMPLETE" }`. (Canvas JSON is the source of truth;
  the AssumptionNode rows are for querying — per the locked architectural decision.)
- **Per-turn error:** a 502 sets a failed-step marker (route returns `agent`+`round`); show an
  inline "retry this turn" without discarding prior messages.

UI (match inspo.html): SVG arena with the geometry above; the **active** agent shows a ring
glow + a `thinkDot` typing pill while awaiting, then its **speech bubble** fades/floats in
(Framer Motion) near that agent — bubble per the design-system recipe (`#1c1a16`, border
`#38332b`, `border-top:2px solid {agent base}`, radius 13, Spectral 15px / lh1.55, mono
uppercase agent name header). A **round stepper** (3 pills, past/current/future) + mono
round-name label sits above the stage. On `ready`, the stage cross-fades (opacity, ~.7s) to a
"Your assumption map is ready" interstitial with a disabled **→ Launchpad** CTA placeholder —
the real React Flow map is Phase 7.

> The founder node is present but passive in Phase 6 (no live interjection); the
> "You · interjecting" affordance seen in inspo is out of scope here.

## Out of scope (Phase 7)
React Flow assumption map, node side-panel, remediation, the full Responsible-AI visible
safeguards. Phase 6 only *produces + persists* the assumptions and shows the ready interstitial.

## Verification
- `cd frontend && npx tsc --noEmit` and `cd backend && npx tsc --noEmit` clean.
- `next build` clean (no new warnings).
- `npm run dev` (per the project memory: run after **each** Phase 6 step, since the debate is
  sequential and complex). Public `/api/war-room/*` routes let the debate/synthesis logic be
  exercised, but full E2E (`GET`/`PATCH /api/sessions/[id]`) is **gated on the outstanding
  Auth0 dashboard items** (client id/secret + email-claim Action) — note this when reporting.
  When unblocked: sign in → intake → enter session → watch 3 rounds → synthesis → confirm rows
  with `docker exec foundr-db psql -U foundr -d foundr -c 'select agent,round from "DebateMessage" order by "createdAt"; select claim,status from "AssumptionNode";'`.
- Before stopping: append a dated Phase 6 entry to `.claude/LOG.md` and refresh the live-state
  sections of `frontend/CLAUDE.md` (🔴 Outstanding / Current Status / Next task).
