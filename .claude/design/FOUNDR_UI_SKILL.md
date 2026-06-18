---
name: foundr-war-room-design
description: >
  Design system for FOUNDR / Tera — the "War Room" multi-agent idea stress-testing
  product (a B2B freight-logistics platform). Use this skill whenever building or
  editing ANY UI for FOUNDR: screens, panels, cards, agent bubbles, assumption maps,
  nav, buttons, badges. It defines the canonical dark-warm palette, the three agent
  accent colors (Skeptic / Strategist / Operator), the Spectral + Hanken Grotesk +
  JetBrains Mono type system, the spacing & radius scale, and reusable component
  patterns. Reference it automatically when the user asks for new FOUNDR UI so the
  output matches the existing look and feel.
---

# FOUNDR · War Room — Design System

FOUNDR is a founder co-pilot. Its **War Room** runs an idea (e.g. *Tera*, an AI comms
layer for freight brokers) through three opinionated AI agents who debate it, then
distills the debate into an **assumption map**. The aesthetic is a **dark, warm,
editorial "situation room"** — confident, literary, dense but calm. Not a SaaS dashboard,
not neon cyberpunk. Think a dimly lit walnut roundtable with one overhead light.

> **Canonical source:** `War Room Roundtable.dc.html`. Two alternate exploration
> directions also live in the repo — a **light editorial** direction (warm paper,
> red-pen markup) and a **boardroom** direction (navy + gold + Cormorant). Those are
> explorations; build new product UI in the dark-warm canonical system below unless
> told otherwise. Their palettes are recorded at the end for reference.

---

## 1. Color tokens

### Surfaces & backgrounds (dark warm neutrals)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0f0e0c` | App background (base of the radial gradient) |
| `--bg-grad` | `radial-gradient(ellipse 120% 80% at 50% 0%, #14120f 0%, #0f0e0c 60%)` | Full-stage background — light pools at top |
| `--surface-1` | `#131210` | Sidebar / structural chrome |
| `--surface-2` | `#15140f` | Detail panels, deep wells |
| `--surface-3` | `#1a1916` | Cards, list items, inputs, buttons (the workhorse surface) |
| `--surface-4` | `#1c1a16` | Agent speech bubbles, elevated cards |
| `--surface-5` | `#211d18` | Founder ("you") bubble, warmest elevation |
| `--well` | `#16140f` | Consensus card / inset wells |
| `--table` | `radial-gradient(ellipse 70% 70% at 50% 38%, #2c2620 0%, #221d18 45%, #1a1611 100%)` | The roundtable disc |

### Borders & hairlines
| Token | Hex | Use |
|---|---|---|
| `--border` | `#2e2c28` | Default card / input / nav border |
| `--border-strong` | `#38332b` | Bubble & elevated-card border |
| `--border-warm` | `#4a443a` | Founder bubble, consensus, emphasis |
| `--hairline` | `#1f1e1b` | Header / footer separators |
| `--hairline-faint` | `#322b24` | Table rim, very subtle dividers |
| `--border-hover` | `#4a463f` | Border color on hover for interactive chrome |

### Text
| Token | Hex | Use |
|---|---|---|
| `--text` | `#ede9e0` | Primary text (warm off-white). **Never pure #fff.** |
| `--text-soft` | `#b8b2a7` | Body copy in detail panels |
| `--text-muted` | `#9a958c` | Secondary / descriptive text |
| `--text-dim` | `#7a7670` | Meta, captions, mono labels |
| `--text-faint` | `#5a574f` | Section eyebrows, disabled, faintest |

### Agent accent colors (the heart of the system)
Each agent has a **base** (structural — rings, dots, borders, map nodes) and a brighter
**text/label** tint for legibility on dark surfaces.

| Agent | Role verb | Base | Text/label | Glow / wash |
|---|---|---|---|---|
| **The Skeptic** | CHALLENGES | `#c2692a` (burnt orange) | `#c2692a` | `rgba(194,105,42,0.12–0.14)` |
| **The Strategist** | REFRAMES | `#3a5a8a` (slate blue) | `#6f93c4` | `rgba(58,90,138,0.16)` |
| **The Operator** | GROUNDS | `#4a7c59` (forest green) | `#6fa37e` | `rgba(74,124,89,0.16)` |
| **You / Founder** | FOUNDER | `#8a7a6a` (warm taupe) | `#a8987f` | `rgba(138,122,106,0.18)` |

JS object form (as used in the logic class):
```js
AC  = { sk: '#c2692a', st: '#3a5a8a', op: '#4a7c59' };  // structural base
ACT = { sk: '#c2692a', st: '#6f93c4', op: '#6fa37e' };  // text / label
```

### Status colors (assumption map / ledger)
| Status | Color | Meaning |
|---|---|---|
| **Validated** | `#4a7c59` (green) | Supported by evidence |
| **Unvalidated** | `#c2692a` (orange) | Risky, untested — reuses Skeptic orange |
| **Needs info** | `#7a7670` (gray, **dashed** border) | Open question |

Wash + border recipe per status:
```
validated : bg rgba(74,124,89,0.12)  · border 1px solid  #4a7c59
unvalidated: bg rgba(194,105,42,0.12) · border 1px solid  #c2692a
needs-info : bg rgba(122,118,112,0.08)· border 1px dashed #7a7670aa
```

> **Accent-on-surface convention:** to tint a surface with an accent, layer the accent
> at low alpha over the dark surface — `background: {accent}22` (≈13%), `border: 1px solid {accent}66`,
> text in the brighter tint. Status badges use exactly this (`{color}22` fill, `{color}66` border).

---

## 2. Typography

Three families, each with one job. Loaded from Google Fonts.

```html
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Family | Role | Where |
|---|---|---|
| **Spectral** (serif) | Display & voice | Logo, headers, agent names, claim titles, speech text, consensus (use *italic* for quotes & agent dialogue) |
| **Hanken Grotesk** (sans) | UI & body | Body copy, buttons, nav labels, descriptions. `body` default. |
| **JetBrains Mono** (mono) | Labels & data | Eyebrows, kickers, meta, timestamps, IDs, status tags |

### Type scale (observed, px)
| Use | Size / weight / family | Notes |
|---|---|---|
| Section header | **23px / 600 / Spectral** | `letter-spacing:-0.005em; line-height:1.05` |
| Detail-panel claim | **23px / 600 / Spectral** | `line-height:1.22; letter-spacing:-0.01em` |
| Hero map node (high-importance) | **20px / 600 / Spectral** | |
| Agent name | **14.5px / 600 / Spectral** | colored per agent |
| Logo wordmark | 16px / 600 / Spectral | |
| Speech / consensus body | **15px / 400 / Spectral** | `line-height:1.55`; consensus is *italic* |
| Body / description | 13–14px / 400–500 / Hanken | `line-height:1.5–1.6` |
| Button label | 12.5–14.5px / 600 / Hanken | |
| Mono eyebrow / kicker | **9–9.5px / Mono** | `letter-spacing:0.14–0.18em; text-transform:uppercase`, color `#7a7670` or `#5a574f` |
| Tiny mono meta | 8.5px / Mono | `letter-spacing:0.12em` |

**Eyebrow pattern** (used everywhere above a heading):
```html
<div style="font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.16em;
            text-transform:uppercase; color:#5a574f;">The three pillars</div>
```

---

## 3. Spacing, radius, elevation

### Spacing scale (px)
Use this restrained set — `gap` on flex/grid, not margins, for groups:
`6 · 7 · 8 · 10 · 11 · 14 · 18 · 20 · 22 · 24 · 26 · 30 · 32 · 34`

- Sidebar / panel padding: `24px 20px` → `26px`
- Card padding: `13px 15px` (compact) · `15px 18px` (bubble) · `18px 22px` (consensus / CTA)
- Header / footer padding: `20px 32px` · `16px 32px`
- Nav item padding: `11px 12px`
- Button padding: `8px 13–14px` (chrome) · `12px 22px` (primary)

### Border radius (px)
| Radius | Use |
|---|---|
| `5px` | status badges |
| `8px` | logo tile, chrome buttons, small wells |
| `9px` | nav items, inputs, "I want to…" buttons |
| `11px` | inner cards, flagged-by row, test box |
| `13px` | speech bubbles, map nodes, consensus, detail cards |
| `14px` | large frames / CTA card |
| `20px` | thinking-dots pill |
| `50%` | avatars, status dots, table disc |

### Elevation (shadows on the dark stage)
Shadows are deep and soft (the room is dark) — often paired with an inset top highlight:
```
card     : 0 10px 30px -14px rgba(0,0,0,0.6)
bubble   : 0 20px 50px -20px rgba(0,0,0,0.8)
consensus: 0 24px 60px -24px rgba(0,0,0,0.85)
table    : 0 40px 90px -30px rgba(0,0,0,0.7), inset 0 2px 0 rgba(237,233,224,0.06)
```
**Selection / active glow** (instead of a heavy shadow): a 2px ring + soft colored bloom in the element's accent —
`box-shadow: 0 0 0 2px {accent}, 0 0 36px -6px {accent}`. Status dots glow with `0 0 8–10px {accent}`.

---

## 4. Component patterns

All styling is **inline** (this is a Design Component project — no stylesheets, no CSS
classes). Repeat the literals; don't factor into tokens in markup. Build animated /
state-driven style strings in the logic class's `renderVals()` and expose them by name.

### Logo tile
28–32px square, `border-radius:8px`, `background:#ede9e0`, dark `#131210` letter "F",
Spectral 700. The wordmark sits beside it with a mono sub-label (`CO-PILOT`).

### Nav item
```
padding:11px 12px; border-radius:9px; display:flex; gap:11px; align-items:center;
active:   background:#1a1916; border:1px solid #2e2c28; color:#ede9e0;
inactive: color:#5a574f (no fill);
```
Active item gets a glowing accent status dot (`7px`, `box-shadow:0 0 8px {accent}`);
inactive items show a hollow ring (`border:1px solid #3a3833`) and a small lock icon.

### Agent avatar
64px circle, simple bust SVG (head circle + shoulders arc) stroked in the agent's base
color at 2.4px, filled with the agent's wash at ~14–16% alpha. Below: Spectral name in
the agent's text tint + a mono role verb (`CHALLENGES` / `REFRAMES` / `GROUNDS`).
A **think state** shows a 3-dot pill (`thinkDot` keyframe). An **active/speaking** state
shows a ring glow (`inset:-6px; box-shadow:0 0 0 2px {base}, 0 0 30px -4px {base}`).

### Speech bubble
```
background:#1c1a16; border:1px solid #38332b; border-top:2px solid {agent base};
border-radius:13px; padding:15px 18px; box-shadow:0 20px 50px -20px rgba(0,0,0,0.8);
```
Header = mono uppercase agent name in the agent tint. Body = **Spectral 15px** `line-height:1.55`.
A rotated 13px square (`border-right`+`border-bottom`) makes the tail. Founder bubble uses
`#211d18` / `#4a443a` border / `#8a7a6a` top accent and *italic* body.

### Map / assumption node
Width scales with importance: `162 / 192 / 236px` for imp `1 / 2 / 3`. Status-colored
wash + border (dashed for needs-info). Mono uppercase status badge on top (high-importance
unvalidated nodes prefix a `★`), Spectral title (14 / 16 / 20px by importance), mono agent
meta beneath. Selected node scales `1.04` and gains the accent ring glow.

### Detail panel (right rail, 372px)
Mono "Assumption detail" eyebrow + status badge → Spectral 23px claim → soft body →
"Flagged by" row (agent dot + name) → tinted "How to test it" box (orange wash if
unvalidated, green if validated) → bottom "I want to…" action stack (each button left-aligned,
`#1a1916`, hover border in the relevant accent).

### Buttons
- **Primary:** `background:#ede9e0; color:#131210; border:none; border-radius:9px;`
  Spectral 600, padding `12px 22px`, hover → `#fff`. Often paired with an inline arrow SVG.
- **Chrome / secondary:** `background:#1a1916; border:1px solid #2e2c28; color:#ede9e0;`
  Hanken 600, `border-radius:8px`, hover `border-color:#4a463f`.
- **Ghost:** transparent + `1px solid #2e2c28`, `color:#9a958c`, hover lifts to `#ede9e0`.
- **Action tints (admit/strike/etc.):** `{accent}1a` fill, `{accent}` border at ~35–40%, accent-tint text.

### Input
```
background:#1a1916; border:1px solid #2e2c28; border-radius:9px; padding:11px 15px;
color:#ede9e0; outline:none; font-family:'Hanken Grotesk';
```
A mono uppercase label precedes it and a mono `⏎ to speak` hint follows.

### Status / data badge
Mono, `font-size:9–10px`, `letter-spacing:0.1em`, `text-transform:uppercase`,
`padding:4px 9px`, `border-radius:5px`, colored via the `{color}22` / `{color}66`
fill+border convention.

### Round stepper
Three pill segments (`26×5px`, `border-radius:3px`). Past = `#8a7a6a`, current = `#ede9e0`,
future = `#2e2c28`; `transition:background .3s`. Followed by a mono round-name label.

---

## 5. Layout conventions

- **App shell:** fixed left **sidebar 232px** (`#131210`, right border `#2e2c28`) + flexible
  `<main>` that is a column: **header** (`20px 32px`, bottom hairline `#1f1e1b`) → **stage**
  (`flex:1`, `position:relative`) → optional **footer** input bar.
- **Sidebar rhythm:** logo block → mono section eyebrow → nav → `margin-top:auto` pins a
  context card ("Your idea") to the bottom.
- **Detail rail:** 372px, `#15140f`, left border `#2e2c28`, internal scroll.
- **Stage as theater:** absolutely-positioned actors around a central radial-gradient
  "table"; one soft overhead light = a faint radial glow (`rgba(237,233,224,0.05)`).
  Layers (debate ⇄ map) cross-fade via `opacity` + `pointer-events` transitions (~.7s).
- **Density with calm:** lots of mono micro-labels and hairlines, but generous line-height
  (1.5–1.6) and serif voice keep it literary rather than terminal-busy.
- **Motion:** subtle and slow. `thinkDot` (1.2s 3-dot bounce), `softFloat`, opacity
  cross-fades. State-dependent style strings are computed in `renderVals()` so transitions
  survive re-render — never drive them from inline `@keyframes` bound to template values.
- **Scrollbars:** thin (`7px`), thumb `#2e2c28`, transparent track.

### Base reset (helmet `<style>` — the only legal global CSS)
```css
html, body { margin:0; padding:0; height:100%; }
body { font-family:'Hanken Grotesk', system-ui, -apple-system, sans-serif;
       background:#0f0e0c; color:#ede9e0; -webkit-font-smoothing:antialiased; overflow:hidden; }
*, *::before, *::after { box-sizing:border-box; }
@keyframes thinkDot { 0%,60%,100% { transform:translateY(0); opacity:.4 } 30% { transform:translateY(-4px); opacity:1 } }
@keyframes softFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-3px) } }
```

---

## 6. Voice & content

- **Editorial, decisive, a little literary.** Headers are sentences ("A motion is on the
  floor.", "Your assumption map is ready."). Agents speak in first person with conviction.
- Mono labels are terse and uppercase (`THE THREE PILLARS`, `FLAGGED BY`, `HOW TO TEST IT`).
- No emoji. Iconography is thin-stroke inline SVG (1.8–2px) or simple geometric marks
  (dots, rings, rotated squares) — never illustrative.
- Numbers/data earn their place (conviction %, ICP coverage, call-deflection targets);
  avoid decorative stats.

---

## 7. Alternate exploration palettes (reference only — not the default)

**Light editorial** (`War Room.dc.html` "Markup" frame): paper `#efece3`/`#fdfbf3`,
ink `#1c1917`, borders `#d6d3c7`, **Source Serif 4** + **Geist** + **Geist Mono**, with
Caveat for handwritten margin notes. Agent accents shift saturated: Skeptic `#b91c1c`,
Strategist `#1d4ed8`, Operator `#15803d`; clarify `#b45309`.

**Boardroom** (`War Room Boardroom.dc.html`): navy `#1e2840`, gold `#d4a755`, cream
`#f5f1e8`/`#fdfbf3`, **Cormorant Garamond** + Geist Mono. Same red/blue/green agent
accents as the light editorial direction.

**Situation Room / terminal** (`War Room.dc.html` frame 3): near-black `#07090d`,
phosphor green `#4ade80`, amber `#fbbf24`, **IBM Plex Mono**, scanline overlay.

If a request clearly wants one of these moods, pull its palette; otherwise default to the
**dark-warm canonical system** (sections 1–6).
