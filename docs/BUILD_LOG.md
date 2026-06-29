# Build Log

Append-only chronological record of build phases. Newest entries at the bottom.

---

## Phase 0 — Scaffold & Constitution (2026-06-29)

**Goal:** Stand up the project skeleton and lock in the architecture rules.

**Done:**
- Scaffolded Vite + React + TypeScript app (`npm create vite@latest -- --template react-ts`).
- Installed `framer-motion`.
- Wrote `CLAUDE.md` project constitution: one-liner, rubric, the single
  match-log = single-source-of-truth rule, fictional-data note, stack, and the
  phased build order.
- Set `vite.config.ts` `base: '/REPO_NAME/'` (PLACEHOLDER — replace with the real
  repo name before deploying to GitHub Pages).
- Added `.env` / `.env.*` to `.gitignore` so the Anthropic API key never ships.
- Replaced the Vite starter UI with a placeholder broadcast header carrying a
  pulsing **LIVE** label.

**Verified:** `npm run dev` boots; the page renders the header + LIVE badge.

**Next (Phase 1):** Data model + pure derivation engine — match-log type, then
`deriveStandings` / `deriveForm` / `deriveStats` / `deriveMOTM` as pure functions.

---

## Phase 1 — Data layer & derivation engine (2026-06-29)

**Goal:** Build the single source of truth (the match-log) and the pure engine
that derives everything from it — with NO visual components yet.

**Done:**
- `src/data/types.ts` — `Team`, `Player`, `MatchResult` (the log unit),
  plus derived-view types `StandingsRow`, `MatchStats`, `TitleRaceState`,
  `FormResult`. Derived types are documented as never-stored.
- `src/engine/engine.ts` — pure functions only:
  - `computeStandings(results, teams?)` → rows sorted points → gd → gf
    (deterministic `teamId` final tiebreak), chronological W/D/L `form`,
    1-based `position`; optionally seeds 0-game teams.
  - `computeMatchStats(result)` → possession/shots/xG for the bars.
  - `pickMOTM(result, players)` → Player (explicit `motmId`, else a
    deterministic winning-scorer fallback).
  - `titleRaceState(standings)` → `{ leaderId, gapToSecond }`.
- `src/data/season.ts` — 4 fictional teams (distinct colors), 3 players each,
  and a scripted 12-match double round-robin. The log is authored so the
  underdog **Kestrel City** climbs the table, with the inline intended position
  commented after every matchday.
- `src/verify/verifySeason.ts` + `npm run verify` (via `tsx`) — advances the
  full season, prints the derived table after each matchday, and asserts the
  climb.

**Verified:**
- `npm run verify` → ✅ PASS. Underdog position by matchday: **4 → 3 → 3 → 2 →
  2 → 1**; title sealed on the final day (KES 2-1 VEL), champions by 1 point.
- `npm run build` → clean `tsc` typecheck + Vite build.
- Adversarial review (4-dimension agent workflow): engine purity, narrative
  arithmetic, fictional-data safety, and spec conformance all passed; **0
  confirmed defects**. Applied one hardening (defensive-copy `form` arrays).

**Next (Phase 2):** Interactive core — `useReducer` over the played slice;
"Final Whistle" advances a matchday; FLIP standings reorder + leader flash;
animated scoreboard and stat bars.

---

## Phase 2 — Interactive core (Final Whistle + FLIP reorder) (2026-06-29)

**Goal:** The most heavily graded feature — drive the match-log with a reducer
and animate the derived views.

**Done:**
- `src/state/matchLogReducer.ts` — `useReducer` state `{ playedMatchdays }`.
  Actions `SIMULATE_FINAL_WHISTLE` (advance one matchday, capped) and `RESET`.
  This integer is the only mutable state; every view re-derives from
  `season.filter(m => m.matchday <= playedMatchdays)`.
- `src/components/StandingsTable.tsx` — framer-motion `layout` on each row
  (keyed by teamId) so rows physically SLIDE on reorder (FLIP). Gold highlight
  + glow on 1st; one-shot gold `leader-flash` overlay on the new leader; W/D/L
  form pips.
- `src/components/Scoreboard.tsx` — current matchday fixtures with spring-in
  animated final scores + MOTM (via `pickMOTM`).
- `src/components/StatBars.tsx` — possession/shots/xG split bars whose home fill
  animates width on each whistle; all values from `computeMatchStats`.
- `src/components/ControlBar.tsx` — prominent "Simulate Final Whistle" button
  with a pulsing LIVE dot; disables at full time and reveals "Reset Season".
- `src/components/FormPips.tsx`, `src/data/lookups.ts`, `src/App.tsx`
  orchestrator (leader-change detection for the flash) + broadcast `App.css`.

**Verified (real browser, Playwright + Edge — 14/14 assertions):**
- Pre-season → 6 whistles: DOM table order matches the engine at every step
  (`KES,RID,SOL,VEL` → … → `KES,VEL,RID,SOL`); order physically changes (reorder).
- Leader flash fires on both leader changes (MD1 VEL, MD6 KES).
- Stat bars render with non-zero animated width.
- DOM points equal engine points (KES 13 / VEL 12 / RID 8 / SOL 1) — table &
  stats never disagree (single source of truth).
- Underdog finishes 1st; whistle disabled + RESET + FULL TIME badge at season
  end; RESET returns to pre-season. **Zero console/runtime errors.**
- `npm run build` clean; `npm run verify` still ✅.
- (Playwright was used only for this check and then removed — no test suite is
  committed; `tsx`/`npm run verify` remains the standing data check.)

**Next (Phase 3):** MOTM selection UI + deeper analytics (per-team season
aggregates, top scorers, xG vs goals).

---

## Phase 3 — Spotlight & depth (MOTM lower-third + momentum) (2026-06-29)

**Goal:** Add the broadcast spotlight and analytical depth on top of the
interactive core — all still derived from the match-log.

**Done:**
- Engine (pure): `computeMomentum(result)` (xG-swing → dominant side + home
  share), `motmForMatch(result, players)` (player + goals + team xG + scoreline),
  and `pickMatchdayMOTM(results, players, md)` (the matchday standout, ranked
  goals → team xG → win). New derived types `Momentum`, `MotmSpotlight`.
- `src/components/MOTMCard.tsx` — a broadcast "lower-third": team-color accent
  bar, "MAN OF THE MATCH" kicker, big player name, scoreline context, and a
  goals · team-xG stat block. Slides in from the left on each whistle and swaps
  per matchday via `AnimatePresence` (keyed by matchId).
- `src/components/Momentum.tsx` — a small per-fixture momentum meter that swings
  out from the centre toward the team that carried the xG, scaled by the swing.
- `src/components/StatBars.tsx` polished into clean labeled rows
  (home value · label · away value, leading value tinted) above each animated
  split bar, with the momentum meter embedded per fixture.
- Wired the lower-third into `App.tsx` as a full-width band under the controls.

**Verified (real browser, Playwright + Edge — 16/16 assertions):**
- MOTM lower-third updates every matchday with the engine-correct player and
  stat line: Okafor(2/2.8) → Okafor(1/1.9) → Brandt(1/2.0) → Ferris(2/2.6) →
  Okafor(1/2.7) → Ferris(1/1.7); 5 distinct transitions; accent color tracks
  the MOTM's team (KES amber at MD6).
- Momentum reads sensibly from the log every matchday, e.g. MD4 `VEL +0.7 xG`
  (VEL out-xG'd RID yet lost — against the run of play) and MD6
  `Balanced | Balanced` (tight title decider); balanced fixtures show no fill.
- `npm run build` clean; `npm run verify` still ✅; zero console/runtime errors.

**Next (Phase 4):** AI Pundit — raw `fetch` to the Anthropic API for match
commentary on the current matchday (key from env; no SDK).

---

## Phase 4 — Creative feature: AI Performance Analyst (2026-06-29)

**Decision:** the brief targets "Live Performance Analytics", so the AI is framed
as a DATA-DRIVEN ANALYST (xG, possession, shots, over/underperformance, title
math), not a hype pundit. Provider switched from Anthropic to **Google Gemini**
per request (CLAUDE.md updated to match).

**Step 1 — verified live before coding (no fabrication):**
- Free Flash models confirmed on the live pricing page: `gemini-2.5-flash`,
  `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.5-flash`
  (`gemini-2.0-flash` deprecated/shut down 2026-06-01).
- Pinned **`gemini-3.5-flash`** — newest GA/stable *and* free (per the "prefer a
  newer confirmed-free Flash" rule). Single constant in `gemini.ts`.
- CORS verified by real curl against the endpoint: OPTIONS preflight → 200
  allowing `POST` + `x-goog-api-key,content-type`; POST reflects `Origin` and
  returns readable JSON. Browser calls work.
- Verified the thinking pitfall: 2.5/3.x Flash think by default and thinking
  tokens consume `maxOutputTokens`; mitigated with `thinkingConfig.thinkingBudget:0`.

**Done:**
- `src/ai/gemini.ts` — single raw `fetch` to `…/v1beta/models/gemini-3.5-flash:generateContent`
  (`x-goog-api-key` header; body = system_instruction + contents +
  generationConfig{maxOutputTokens:600, temperature:0.7, thinkingBudget:0}).
  Parses `candidates[0].content.parts[].text`; classifies failures
  (rate-limit/auth/http/empty/network).
- `src/ai/analyst.ts` — pure prompt builder (analyst system instruction; asks for
  a 3-4 sentence data read + one-line title verdict) **and** the mandatory
  `fallbackAnalysis` — deterministic, grounded in real deltas (goals-vs-xG,
  possession, points gap, matchdays left).
- `src/components/AnalystDesk.tsx` — desk panel: in-memory key input (+ "make a
  NEW key" hint), auto-generates per whistle, typewriters the result, shows a
  Live/Offline tag, Skip/Re-run. Key in React state only; never persisted.
- `.env.example` (gitignored `.env`), `vite-env.d.ts` env typing.

**Verified (real browser, Playwright + Edge — 23/23):** live success parses &
types out; correct endpoint/header/body (incl. thinkingBudget:0, 600, 0.7);
prompt embeds the matchday data; key never persisted (localStorage/sessionStorage
empty); 429 → offline tag + deterministic analysis; empty-200 (thinking pitfall)
→ fallback; no-key → fallback (xG-grounded); Re-run returns to live; 0 JS errors.
`npm run build` clean.

**Adversarial review (4-dim agent workflow):** key-security EXCELLENT, fallback
guarantee correct, async correct, spec fully compliant. 1 minor defect confirmed
(malformed JSON mis-tagged network vs http) → **fixed** (json parse now inside the
error contract).

**Next (Phase 5):** Final polish (TV-graphics theme, responsive), README with a
graded Creative Feature section, GitHub Pages deploy.

---

## Phase 5 — Polish, README & deploy (2026-06-29)

**Goal:** TV-sports-graphics finish, full docs, and deployment readiness.

**Done:**
- **Theme/responsive pass** — stadium-at-night background (floodlight radial
  glows + faint pitch stripes), consistent team-color accents, the pulsing LIVE
  dot, and the lower-third styling. Added breakpoints (≤920px single column,
  ≤620px stacked header/controls) and fixed the CSS grid `min-width:auto` gotcha
  (`minmax(0,1fr)` + `min-width:0` on panels) so the table scrolls inside its
  panel instead of widening the page.
- **README.md** — overview, run/scripts, the single-match-log architecture, and a
  dedicated **Creative Feature** section (what the AI analyst does, the verified
  client-side Gemini call, and the deterministic fallback).
- **docs/OVERVIEW.md** — one-paragraph overview.
- **Deploy** — confirmed `vite base = '/FIFA_HACKUP26_QF/'`; added a `gh-pages`
  manual deploy (`npm run deploy`) and an Actions workflow
  (`.github/workflows/deploy.yml`).

**Verified (production build, Playwright + Edge — 8/8):** `npm run build` clean;
served via `vite preview` under `/FIFA_HACKUP26_QF/` — bundle paths are
base-prefixed, **no failed asset requests**, full season plays through to Kestrel
City champions, analyst desk renders (offline fallback, no key in CI), **0
runtime errors**, and **no horizontal overflow at 390px** (mobile). `npm run
verify` still ✅.

**Deploy steps (run by repo owner):** `git init && git add -A && git commit` →
push to `github.com/ChaitanyaKis/FIFA_HACKUP26_QF` → `npm run deploy` (or push to
`main` with Pages source = GitHub Actions).
**Live URL:** `https://chaitanyakis.github.io/FIFA_HACKUP26_QF/`

**Status:** all five phases complete; rubric coverage — UI/UX (broadcast theme,
animations, responsive), Core Features (table/stats/scoreboard/MOTM), Interactive
Logic (Final Whistle + FLIP + derive-everything engine), Creative Feature (AI
Performance Analyst with stage-safe fallback).
