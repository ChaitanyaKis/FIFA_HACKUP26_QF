# League Standings Leaderboard & Live Performance Analytics Portal

A broadcast-style portal that tracks a 4-team league season and turns it into
**live performance analytics**. Hit **Simulate Final Whistle** to play the next
matchday: the table physically re-orders, the stat bars and momentum meters
animate, a Man-of-the-Match lower-third slides in, and an **AI Performance
Analyst** writes a short, data-driven read of what just happened.

> All teams, players and results are **fictional** — no real clubs, people or
> leagues are referenced anywhere.

**Live demo:** `https://chaitanyakis.github.io/FIFA_HACKUP26_QF/`
*(GitHub Pages serves the username lowercased; the repo path keeps its case.)*

---

## What it does

- **League table** — 4 teams, sorted points → goal difference → goals for, with
  a gold-highlighted leader, W/D/L form pips, and FLIP slide animations on every
  re-order.
- **Final Whistle** — advances one matchday at a time; **Reset** restarts the
  season. The whole season is scripted so the underdog **Kestrel City** climbs
  from 4th to 1st, sealing the title on the final day.
- **Scoreboard** — the matchday's fixtures with animated scores + MOTM.
- **Match Analytics** — possession / shots / xG comparison bars, plus a
  per-fixture **momentum** meter derived from the xG swing.
- **MOTM lower-third** — a TV-style graphic spotlighting the matchday's standout.
- **AI Performance Analyst** — the creative feature (see below).

---

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173/FIFA_HACKUP26_QF/
```

Other scripts:

```bash
npm run build      # type-check (tsc) + production build to dist/
npm run preview    # serve the production build locally (under the Pages base)
npm run verify     # prove the scripted season: prints the table after each
                   # matchday and asserts the underdog climbs 4th → 1st
```

**Optional — enable the live AI analyst:** get a **new** key from
[Google AI Studio](https://aistudio.google.com/app/apikey) and either paste it
into the in-app "AI Performance Analyst" field, or copy `.env.example` to `.env`
and set `VITE_GEMINI_API_KEY`. Without a key the analyst still works via its
deterministic fallback. `.env` is gitignored and the key is never persisted.

---

## Architecture — one match-log, everything derived

The core rule (see [`CLAUDE.md`](./CLAUDE.md)): a **single match-log is the only
source of truth.** The only mutable state in the app is one integer —
`playedMatchdays` — held in a `useReducer`. Everything the UI shows is **derived
on every render** by pure functions from the played slice of the log:

```
match-log (src/data/season.ts)
        │  season.filter(m => m.matchday <= playedMatchdays)
        ▼
pure engine (src/engine/engine.ts)
  computeStandings · computeMatchStats · pickMOTM · computeMomentum ·
  pickMatchdayMOTM · titleRaceState
        ▼
components render derived views (never store them)
```

Because standings, stats, MOTM, form and the title race are **recomputed, never
stored**, the table and the numbers can never desync. The engine is pure (no I/O,
no clock, no randomness), which is what makes `npm run verify` a deterministic
proof of the whole season.

```
src/
  data/      types.ts · season.ts (the match-log) · lookups.ts
  engine/    engine.ts (all pure derivations)
  state/     matchLogReducer.ts (playedMatchdays + SIMULATE_FINAL_WHISTLE / RESET)
  ai/        analyst.ts (prompt + deterministic fallback) · gemini.ts (the fetch)
  components/ StandingsTable · Scoreboard · StatBars · Momentum · MOTMCard ·
              ControlBar · AnalystDesk · FormPips
  verify/    verifySeason.ts (runnable season proof)
```

---

## Creative Feature — the AI Performance Analyst

A live **analyst desk** that reads each matchday's data and writes a short,
**data-driven** tactical/statistical analysis — framed as an analyst (xG,
possession, shots, over/under-performance, title-race math), not a hype pundit.
This leans directly into the "Live Performance Analytics" brief.

### What it produces
After each whistle it files: (a) a 3–4 sentence read of the matchday — who the
xG/possession/shots favoured, any goals-vs-xG over/under-performance, and a
stats-justified Man of the Match — and (b) a one-line **Title race:** verdict
from the points/gap math. The text **types out** progressively into the panel.

### How the client-side LLM call works (verified, no SDK)
- **Provider/model:** Google Gemini, **`gemini-3.5-flash`** — verified GA/stable
  *and* free on the live [models](https://ai.google.dev/gemini-api/docs/models)
  and [pricing](https://ai.google.dev/gemini-api/docs/pricing) pages
  (free tier ≈ 15 req/min, 1500/day). The model is a single constant in
  `src/ai/gemini.ts`.
- **Request:** one raw `fetch` (no SDK, no streaming) —
  `POST …/v1beta/models/gemini-3.5-flash:generateContent`, headers
  `x-goog-api-key` + `Content-Type: application/json`. **CORS was verified for
  real** against the endpoint (OPTIONS preflight returns 200 allowing `POST` +
  `x-goog-api-key,content-type`; the POST reflects the page `Origin`), so the
  browser call works directly from GitHub Pages.
- **Body:** `system_instruction` (frames the analyst) + `contents` (the matchday
  data block) + `generationConfig` with `maxOutputTokens: 600`,
  `temperature: 0.7`, and `thinkingConfig.thinkingBudget: 0`. The last one
  matters: 2.5/3.x Flash "think" by default and thinking tokens are charged
  against the output budget, which can return empty text — disabling it sends the
  full budget to the answer.
- **Parsing:** Gemini's shape — `data.candidates[0].content.parts[].text`
  (joined), **not** Anthropic's `content[].text`.
- **Key handling:** entered at runtime and kept in React state **only** — never
  written to `localStorage`/`sessionStorage`/cookies, never logged, never put in
  a URL or an error message, and never committed (`.env` is gitignored).

### The deterministic fallback (why it never dies on stage)
If there is **no key**, or the call **fails / 429 rate-limits / returns empty**,
the panel seamlessly shows a deterministic analysis generated from the match-log
by `fallbackAnalysis()` — templated but grounded in **real deltas** (e.g.
"clinical, turning 1.1 xG into 2 goals (overperformed by 0.9)", "leads by 2
points with 2 matchdays to play"). It reads like analysis, never a raw error, and
a small tag (e.g. *"Rate limit (429) — deterministic analysis"*) shows why it's
offline. The killer feature works with or without the network.

---

## Deploy to GitHub Pages

`vite.config.ts` already sets `base: '/FIFA_HACKUP26_QF/'` (must match the repo
name). Two supported paths:

**A) One-command manual deploy** (publishes `dist/` to a `gh-pages` branch):

```bash
git init && git add -A && git commit -m "League analytics portal"
git branch -M main
git remote add origin https://github.com/ChaitanyaKis/FIFA_HACKUP26_QF.git
git push -u origin main
npm run deploy
```

Then: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `root`.**

**B) Automatic CI deploy** — push to `main` and the included workflow
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and
publishes. Set **Settings → Pages → Source: GitHub Actions** once.

**Live URL:** `https://chaitanyakis.github.io/FIFA_HACKUP26_QF/`

---

## Tech

React + TypeScript + Vite · framer-motion (FLIP / animations) · raw `fetch` to
Gemini (no SDK) · in-memory state only (no persistence). Build journal in
[`docs/BUILD_LOG.md`](./docs/BUILD_LOG.md).
