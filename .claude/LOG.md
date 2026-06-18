# FOUNDR — Session Log

All session records, change notes, and build decisions go here. Append a dated entry after every session.

---

## 2026-06-17

### Phase 0: Groundwork & Verification

- Fixed `frontend/.gitignore`: added `!.env.example` so the template file isn't swallowed by the `.env*` glob.
- Created `frontend/.env.example` and `backend/.env.example` with all required placeholder keys.
- Confirmed `tsconfig.json` alias and `components/ui/button.tsx` location are already correct — no changes needed.
- Read Next.js 16 upgrade guide; key finding: `params` must be awaited everywhere (see Gotchas in CLAUDE.md).

### Phase 1: Prisma schema + backend compilation

- Added all new models and enums to `schema.prisma` (`WarRoomSession`, `DebateMessage`, `AssumptionNode`, three enums).
- Removed invalid `url =` from datasource block (Prisma 7 breaking change).
- Fixed `prisma.ts`: added `PrismaPg` adapter — `new PrismaClient()` with no args is a compile error in Prisma 7.
- Fixed deploy workflow: wrong PM2 start path (`index.js` → `npm -- start`); added `prisma migrate deploy`; added explicit `--config` flags.
- `prisma generate` succeeds. Migration pending (needs live DB).

### Phase 2: Express sessions scaffolding

- Created `backend/src/middleware/requireUser.ts` — resolves `User` from JWT sub; returns null + sends response if user not found.
- Created `backend/src/v1/sessions/index.ts`:
  - `POST /v1/sessions` — create session, return id
  - `GET /v1/sessions/:id` — fetch session + transcript + assumptions, owner-checked
  - `PATCH /v1/sessions/:id` — update canvas/status, append messages, replace assumptions; all in a transaction
- Mounted under `/v1/sessions` with `checkJwt` in `index.ts`.
- `tsc --noEmit` passes clean.

### Backend: Pre-existing bugs fixed

- Removed duplicate unrestricted `cors()` call — the configured origin allowlist was being defeated. Added `http://localhost:3000` for local dev.
- Applied `checkJwt` to `/v1/auth` router — it was defined but never mounted, so every sync call returned 401.
- Moved error handler to after route mounts — Express only catches errors from routes registered above the handler.
- Added missing `return` to `UnauthorizedError` branch to prevent fall-through.
- Guarded `payload.email` in `sync.ts` with an early 400 — Auth0 access tokens omit email by default, and the field is required+unique in Prisma.

### Sessions router hardening (post-review)

- Added `@@unique([sessionId, agent, round])` to `DebateMessage` + `skipDuplicates: true` on createMany — retries are now idempotent.
- Changed assumption writes to delete-then-recreate — no natural unique key; this is the safe idempotency pattern.
- Changed ownership checks to `findFirst({ where: { id, userId } })` — eliminates the 403 vs 404 session-existence leak.
- Added runtime enum/type validation to all PATCH/POST inputs — bad data now returns a 400 instead of a Prisma 500.
- Created root `.gitignore` with `.DS_Store` and `node_modules/`.

---

## 2026-06-18

### Phase 3: Frontend Shell

- Established the FOUNDR dark palette as the only theme — removed light mode entirely; `:root` always carries the dark tokens (`#0a0a0f` bg, `#111118` surface, `#2a2a35` border). Agent accent colors (`--agent-skeptic/strategist/operator`) exposed as Tailwind utilities via `@theme inline`.
- Added `Playfair Display` (normal + italic) as `--font-serif` for the War Room session header; Geist Sans remains the primary UI font.
- Installed `@xyflow/react`, `framer-motion`, `@google/genai` — all required for Phases 4–7.
- Built `app/layout.tsx` with full-height sidebar + scrollable main panel side-by-side. Sidebar is always visible on all routes (per product decision).
- Built `components/Sidebar.tsx` (Client Component): FOUNDR logo, three-pillar nav with active-path detection via `usePathname()`, lock badges on Launchpad and Pitch Coach, empty-state idea summary card at bottom.
- Rewrote `app/page.tsx` as the FOUNDR hero inside the main panel: headline, agent intro trio with accent colors, "Enter the War Room →" CTA, responsible AI footnote.
- Created placeholder pages for `app/launchpad/page.tsx` and `app/pitch-coach/page.tsx` — locked states with feature descriptions; never 404.
- Created shell pages for `app/war-room/page.tsx` and `app/war-room/session/[id]/page.tsx` — the session page uses `await params` (Next.js 16 breaking change).
- `tsc --noEmit` passes clean.
- **Gotcha:** `mkdir -p` with a literal `[id]` in the path fails in zsh due to glob expansion — must quote the path.

### Phase 3 UI visual refresh (design-system alignment)

- **globals.css:** Shifted palette from cool blue-black (`#0a0a0f`) to warm editorial dark (`#0f0e0c`) with radial gradient on body. Updated all shadcn token values and agent accent colors to match the warm design-system palette (`#c2692a` Skeptic, `#6f93c4` Strategist, `#6fa37e` Operator). Added warm surface levels (`--surface-1` through `--surface-4`), border levels (`--border-strong`, `--border-warm`, `--hairline`), and text scale (`--text-soft/dim/faint`) as Tailwind utilities. Added thin warm scrollbar styles and `thinkDot`/`softFloat` keyframes for Phase 6.
- **layout.tsx:** Replaced Geist + Geist Mono + Playfair Display with **Spectral** (serif display), **Hanken Grotesk** (sans body), and **JetBrains Mono** (mono labels) per the design system.
- **Sidebar.tsx:** Logo tile now uses `#ede9e0` white square with Spectral "F" + wordmark + JetBrains Mono "CO-PILOT" sublabel. Nav eyebrow uses mono uppercase. Active nav item gets a glowing 7px accent dot (War Room `#c2692a`, Launchpad `#6fa37e`, Pitch Coach `#6f93c4`); inactive items use hollow ring and `#5a574f` text. Idea card uses warm well surface with Spectral italic placeholder text.
- **page.tsx:** Mono uppercase eyebrow. Headline splits Spectral italic ("Stress-test your idea") from lighter sans ("before the market does."). Feature trio cards carry per-agent color washes with mono role verb (`CHALLENGES`/`SURFACES`/`GROUNDS`) and Spectral card title. Responsible AI footnote in mono uppercase.
- **launchpad/page.tsx + pitch-coach/page.tsx:** Icon tiles and lock badges use agent-colored washes. Headings in Spectral. Labels in JetBrains Mono eyebrow pattern.

### Added design system resources + priority hierarchy

- Added `FOUNDR_UI_SKILL.md` to `.claude/design/` — canonical design system with warm color tokens, Spectral/Hanken Grotesk/JetBrains Mono type stack, spacing scale, component patterns, and agent accent color definitions. This is the project-level source of truth that wins over any global Claude design skills.
- Added "Design Skills & Priority Hierarchy" section to `CLAUDE.md` documenting the three-layer priority: `frontend-design` (global) < `ui-ux-pro-max` (global) < `design-system` (project-level `.claude/design/FOUNDR_UI_SKILL.md`). Future sessions must read the design system skill before writing any UI code.

### Code review fixes (post-Phase 3)

- **Backend:** Added `claim` and `explanation` string validation to `PATCH /v1/sessions` assumption loop — previously only enum fields were checked; a malformed client could send empty strings and trigger a Prisma error instead of a clean 400.
- **Sidebar:** Removed `pointer-events-none` from locked pillar links — placeholder pages exist and should be reachable. Visual lock state (opacity-50 + lock icon) is sufficient.
- **Responsive grids:** Changed `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` in `app/page.tsx` and `app/launchpad/page.tsx` — hardcoded 3-col grid was unreadable on narrow viewports.
- **Layout:** Added `overflow-x-auto` to `<body>` and `min-w-0` to `<main>` — prevents sidebar squeezing main content into zero width on narrow screens; falls back to horizontal scroll.
- **Turbopack root:** Set `turbopack: { root: __dirname }` in `next.config.ts` — stops Turbopack from walking up to the parent `package-lock.json` at `/Users/ericwei/USAII/` and inferring the wrong workspace root.

---

## 2026-06-18 (continued)

### Phase 4: Gemini Service & Prompts

- Created `frontend/prompts/agents.ts` — three agent system prompts (`SKEPTIC_SYSTEM`, `STRATEGIST_SYSTEM`, `OPERATOR_SYSTEM`), `ASSUMPTION_MAP_SYSTEM`, `QUESTION_GEN_PROMPT`, and four round context builder functions (`buildRound1Prompt`, `buildRound2Prompt`, `buildRound3Prompt`, `buildAssumptionMapPrompt`). Zero inline prompt strings anywhere else.
- Created `frontend/lib/gemini.ts` — `callGemini(systemPrompt, userPrompt)` using `@google/genai` v2 `ai.models.generateContent`, and `parseJSON<T>()` helper that strips markdown code fences before parsing.
- Created `app/api/war-room/questions/route.ts` — POST `{ ideaSummary }`, returns `{ questions: string[] }` (exactly 3).
- Created `app/api/war-room/debate/route.ts` — POST `{ agent, round, ideaSummary, questionnaireResponses, transcript }`, dispatches to the correct round builder and agent system prompt, returns `{ content: string }`.
- Created `app/api/war-room/assumptions/route.ts` — POST `{ ideaSummary, questionnaireResponses, transcript }`, returns `{ assumptions: AssumptionNode[] }` with enum sanitization to prevent bad data reaching the frontend.
- `tsc --noEmit` passes clean.

### Phase 4 review pass (before Phase 5)

- **gemini.ts error handling:** Added `GeminiError` and `GeminiParseError` classes. `callGemini` now try/catches the SDK call (network/auth/rate-limit failures surface cleanly instead of crashing a debate round), guards against empty/safety-blocked responses, and checks `GEMINI_API_KEY` is set. Added optional `{ temperature }` so JSON calls can run cooler than prose. `parseJSON` now throws `GeminiParseError` with a 200-char snippet instead of a bare `SyntaxError`.
- **Persona distinctiveness:** Added a "Stay in your lane" rule and a voice/opening signature to each of SKEPTIC/STRATEGIST/OPERATOR so responses diverge — Skeptic phrases concerns as questions and stays off market sizing/build detail; Strategist anchors in market comparisons and is told NOT to fabricate statistics; Operator names concrete dependencies/sequencing and stays out of market theory.
- **Round context robustness:** `buildRound2Prompt` and `buildRound3Prompt` now slice the transcript internally (`round === 1` for R2; `round < 3` for R3) so the Phase 6 hook can pass the entire running transcript to any call and still get spec-correct context. Renamed params to `transcript`.
- **API route hardening:** All three routes now wrap `req.json()` (bad body → 400), validate required fields before calling Gemini, and catch `GeminiError`/`GeminiParseError` → 502 with a clear message. Debate route requires a transcript for rounds 2/3 and now returns `{ agent, round, content }` so the orchestration hook can correlate/retry a failed step. JSON routes pass low temperature (questions 0.4, assumptions 0.2).
- **Assumption node output:** assumptions route now rebuilds each node from only the contract fields (claim/status/explanation/agentSource/howToTest) — strips any stray keys before they reach the Phase 7 React Flow renderer — and drops `howToTest` on VALIDATED nodes per the contract. Returns 502 if zero valid nodes survive.
- **Divergence flagged:** CLAUDE.md describes Round 3 as directly producing the assumption map; the implementation keeps Round 3 as per-agent closing statements (debate route) plus a separate assumptions synthesis call. Left as-is (better UX + deterministic JSON) — to confirm during Phase 6.
- `tsc --noEmit` passes clean.

### Spec aligned to implementation (Round 3)

- Per user decision, rewrote the CLAUDE.md "Round 3 — Synthesis" section to match the implementation: Round 3 is now **Closing Statements** (3 per-agent debate turns), followed by a **separate single map-synthesis call** (`POST /api/war-room/assumptions`) over the full Rounds 1–3 transcript. Updated the Phase 6 orchestration checklist to: R1 (×3) → R2 (×3) → R3 closings (×3) → assumptions synthesis (×1). No code change — implementation already did this.
