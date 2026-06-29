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

---

## Phase 6 — Real clubs + simulation engine (2026-06-29)

**SEED = 737 · SQUAD_SNAPSHOT_DATE = 2026-06-29**

**Goal:** Replace the scripted season with a real seeded match-simulation, and
the fictional clubs/players with 4 real clubs + real current squads. Keep all
engine derivations, FLIP reorder, MOTM, analytics and the AI analyst intact.

**A — Simulation engine (`sim/`):**
- `ratings.ts` — close `{attack, defense}` per club + `HOME_ADVANTAGE` (kept
  competitive so the title race is emergent).
- `engine.ts` — inline `mulberry32` PRNG (no deps); per fixture
  `lambda = f(attack, oppDefense, homeAdv)`, **goals = Knuth Poisson draw** on
  that lambda (xG = lambda → over/under-performance is real & emergent);
  possession/shots derived from attack share + bounded noise; scorers weighted
  by position (FW>MF>DF>GK); MOTM = best performer (goals + xG). Full season
  pre-simulated from `SEED` at init. **Two independent RNG streams** so match
  outcomes (and standings) depend only on the seed, never on which squads load.
- Authored results **deleted**; `season.ts` now = `simulateSeason(SEED, …)`.
- Invariants hold: ΣGF=ΣGA, one game/club/matchday, scorers/MOTM in-fixture,
  reproducible from SEED. `computeStandings` unchanged (points→GD→GF).
- **Seed-selected** SEED 737 (not scripted) for the best emergent race: leaders
  MUN→RMA→MUN→RMA→BAY→RMA (5 changes); **Real Madrid champion on goal
  difference** over Man United (10–10), Bayern 9, Barça 5 — decided on the final
  day.

**B — Real clubs + current squads (fetched at build time):**
- 4 clubs: Real Madrid, FC Barcelona, Manchester United, Bayern Munich
  (`clubs.ts`, swappable). Real kit colours (Wikipedia/Wikimedia official hex —
  teamcolorcodes.com was 404, so not invented). MUN & BAY share `#DA291C` red →
  distinguished by **real crests + distinct secondary** (MUN navy, BAY white).
- Crests pulled from `luukhopman/football-logos` into `/public/crests/<code>.png`
  (paths validated via the GitHub tree API); **monogram fallback** if missing.
- Squads from each club's Wikipedia **2026–27 season** page (RMA/FCB/BAY); **MUN
  fell back to its 2025–26 page** (2026–27 squad not yet populated) — logged, not
  fabricated. ~11 players each `{id,name,clubId,position}`; one unverifiable name
  dropped rather than invented. `SQUAD_SNAPSHOT_DATE` surfaced in UI + README.

**Framing / honesty:** analyst system + prompt now state the season is SIMULATED
and must not present sim stats as real-world facts; footer reads "Real clubs —
all matches are simulated (squad snapshot 2026-06-29)…"; a gold **SIMULATED** tag
sits in the chrome. Security: the `.env` key is read **dev-only** (guarded by
`import.meta.env.DEV`), so it is dead-code-eliminated from production bundles —
verified the key is absent from `dist/`.

**Verified:** `npm run verify` ✅ (table per matchday, all invariants green,
reproducible, champion RMA). `npm run build` clean. Production build (Playwright +
Edge, 12/12): real crests load as images, SIMULATED tag + dated footer present,
final order `RMA > MUN > BAY > FCB` matches the seed, table reorders, MOTM
lower-third shows real players, analyst renders, 0 errors, no mobile overflow.

---

## Phase 7 — Enriched match events (G1) (2026-06-29)

**SEED = 737 · SQUAD_SNAPSHOT_DATE = 2026-06-29**

**STEP 0 (sim, not script):** re-simulated seeds 738/739/740 — distinct champions
& scores (738→FCB 11, 739→MUN 9, 740→MUN 11; different MD1 scorelines). The engine
is genuinely seed-driven → proceeded. SEED restored to 737.

**Additive enrichment (no goal total changed):** added a **third labelled RNG
stream** `eventRng` (seed ^ 0x85ebca6b) for event detail, alongside the existing
outcome (`rng`) and credit (`scorerRng`) streams. Goal totals/possession/shots
draw ONLY from stream 1, so SEED-737 totals + standings are **byte-identical**
(asserted per fixture + final table). Attached to each fixture:
- **Goal events** — per goal `{minute(1-90/+stoppage), scorerId, assistId|null}`;
  scorer by weight FW>MF>DF (GK never); assist ~65%, a different same-club
  non-GK player; Σ events/club == that club's goal count.
- **Shots on target** — `goals ≤ sot ≤ totalShots`, scaled off xG.
- **Cards** — yellows (common) / reds (rare) `{playerId, minute, type}`.
- **Suspensions** — matchdays simulated IN ORDER carrying accumulated cards:
  red → miss next; 2 accumulated yellows → miss next + reset. Suspended players
  are excluded from scorer/assist/card pools and exposed per fixture
  (`suspended[]`). (e.g. Rüdiger 2×yellow MD1 → out MD2; Kim Min-jae red MD1 →
  out MD2; Mbappé+Mendy out MD6 — totals unchanged.)
- **Player ratings** — every featured player 4.0–10.0 (base 6.5 ± goals/assists,
  clean-sheet/conceded for GK·DF, cards, bounded noise). **MOTM reconciled to the
  top-rated player** of each fixture.
- **Momentum series** — per-5-min signed wave (xG share + noise + Gaussian surge
  at each goal minute, smoothed); a scaled offset guarantees the **higher-xG side
  has the larger positive integral** every fixture (area edge ∝ xG edge).

**Invariants (all asserted in `npm run verify`):** goals≤sot≤totalShots;
Σgoal-events==goals; assists≤goals, assist≠scorer & same club; ΣGF==ΣGA/matchday;
one game/club/matchday; **goal totals + final standings byte-identical** to
pre-enrichment 737 (RMA>MUN>BAY>FCB, RMA & MUN level on 10); every credited player
is in-fixture and not suspended; ratings∈[4,10]; MOTM==top-rated; momentum integral
sign==xG edge; whole season reproducible from SEED.

**Verified:** `npm run verify` ✅ (prints STEP-0, per-matchday goal
minutes/scorers/assists, momentum summary md1-MUN-BAY home-area 38.3 vs away-area
42.4 agreeing with xG 1.7-1.8, all invariants green). `npm run build` clean.
Runtime smoke (Playwright + Edge, 4/4): app renders, champion RMA, order
unchanged, MOTM lower-third renders, 0 errors. UI untouched (data-only phase).

---

## Phase 8 — Analytics layer (G2): engine/derive.ts (2026-06-29)

**All pure functions of a results array** (so What-If in G3 recomputes everything
on edited results). No new event generation; the only randomness is the Monte
Carlo. Additive — core unchanged.

- **computeStandings parameterized** (additive `StandingsOptions`:
  `filter`/`side`/`scoreOf`/`round`) — default 2-arg call is byte-identical, and
  the alternate tables REUSE it (no duplicated accumulation).
- **Leaderboards** — Golden Boot (goals; tiebreak fewer matches → assists; apps
  counted from per-fixture ratings), Assist race, Golden Glove (clean sheets per
  club, attributed to its first-choice GK).
- **Alternate tables** — Home (`side:'home'`), Away (`side:'away'`), Form (last N
  matchdays via `filter`, default 5), xG (`scoreOf` = xG, `round:1`; GD =
  cumulative xGF−xGA) — each a full P/W/D/L/GD/Pts view.
- **Position worm** — each club's 1-4 position after every matchday via
  computeStandings on the played slice (verified == the real table at each point).
- **Title clinch / magic number** — points-based clinch (leader.points > every
  chaser's points + 3×games-left) with magic number; season-complete (0 games
  left) declares the full-tiebreak leader champion. Handles SEED 737 correctly:
  not clinched MD1-5 (magic 16/10/10/6/4, all unreachable), **clinches only on
  the final day** (GD-decided) → champion Real Madrid.
- **Win-probability (Monte Carlo)** — pure over (current standings, remaining
  fixtures, ratings); simulates the rest of the season 2000+ times with the same
  ratings/Poisson model and fresh draws (seeded `mcSeed`, NOT the season SEED),
  whole-% per club, recomputed each matchday; converges to 100/0 at the end.

**Verified (`npm run verify`):** Golden Boot top 3 (Šeško 5 / Rodrygo 4 / Zirkzee
3+3a), Away table (BAY 6·FCB 4·RMA 4·MUN 3), every club's worm row, title clinches
**MD6 → Real Madrid**, win-prob `RMA 41/MUN 31/FCB 14/BAY 13` (MD1) → `RMA 100`
(final). Asserts: **worm == computeStandings at every matchday**, clinch only on
the final day, champion RMA, MC converges to 100/0, MD1 odds sum ≈100. All green;
`npm run build` clean. (derive.ts not yet wired to UI — data layer for G3.)

---

## Phase 9 — Interactive layer (G3): mutable seed + What-If (2026-06-29)

The highest-weighted bucket. The season SEED is now mutable state; the whole
season + all G2 derivations recompute from it (and from What-If edits). Mandatory
core (table, analytics, MOTM, Final Whistle) stays primary + always visible.

**Engine (additive, reuses simulateSeason):**
- Extracted `enrichFixture` (shared by simulateSeason + edits) and added
  `reEnrichFixture(base, hG, aG, players, {scorers})` — re-derives one fixture's
  consistent detail for a What-If edit (sot/cards/ratings/MOTM/momentum), seeded
  deterministically from (fixture id + scoreline) so edits are stable. xG &
  possession unchanged (only finishing changed).
- **Engine fix (not a seed filter):** `shots = max(drawn, goals)` so `goals ≤
  shots` for ANY seed — keeps `goals ≤ sot ≤ shots` valid. Deterministic
  transform, same rng draw count → SEED 737 totals still byte-identical.

**State / UI:**
- `appReducer`: `{ seed, curatedIndex, playedMatchdays, edits }`. Actions:
  SET_PLAYED (scrubber/whistle), NEXT_CURATED, RANDOM_SEED, APPLY_EDIT,
  REVERT_ONE/REVERT_EDITS. Landing seed = **737**.
- `CURATED_SEEDS` (12): scanned **2500** seeds, kept only dramatic races (title
  decided on the final day → gap 0 on GD, ≥3 lead changes, 1st-4th spread ≤5,
  last place ≥5 pts), ordered so consecutive Resets cycle champions
  **RMA→BAY→FCB→MUN→…** (737, 396, 947, 646, 1597, 741, 2302, 763, 279, 210, 226,
  1202).
- Components: **WhatIfEditor** (click a fixture → edit scoreline + per-goal
  scorer), **TitleRacePanel** (live Monte-Carlo win% bars + clinch/magic),
  rewritten **ControlBar** (Season #seed readout, scrubber, Final Whistle,
  Simulate-to-end auto-play, Reset Season, Surprise me, Revert What-If), clickable
  Scoreboard fixtures. App re-derives standings/GD/position/form + win-prob +
  clinch from seed+edits; FLIP runs on every change.

**Acceptance — verified.** `npm run verify`: landing 737; curated resets 1-3 →
RMA/BAY/FCB (distinct); **20 random (uncurated) seeds × 12 fixtures = 240, all
invariants hold** (engine robust, no seed filtering); What-If md6-BAY-RMA→BAY 2-0
RMA **flips champion RMA→BAY** with the edited fixture passing all invariants.
Browser (Playwright + Edge, 16/16): active seed shown; scrubber drives FLIP both
ways; **editing a result live cascades** standings+GD+position+form+win-prob+
clinch and FLIPs (champion RMA→BAY, BAY win-prob→100%); WHAT-IF indicator + Revert
restore the sim; **3 Resets → 3 different champions** (BAY/FCB/MUN); Surprise me →
random season; 0 console errors. `npm run build` clean.

---

## Phase 10 — Two-way AI analyst + track record (2026-06-29)

Elevated the analyst from "narrates" to a two-way tactical analyst WITH a track
record. Gemini `gemini-2.5-flash` (runtime key, in-memory) + the deterministic
grounded fallback. Every prompt states the season is SIMULATED and forbids
real-world claims about the real players.

- **Deep tactical read** — the post-matchday prompt now also carries Golden Boot
  leader, per-club win probability, the magic number, a momentum summary
  (control + against-the-run-of-play), SOT/shots/xG quality, and a derby flag
  (El Clásico). Asks for who deserved it on xG/momentum, over/under-performance,
  game-state reading, and a one-line title verdict that **cites the win-prob %**.
- **Ask-the-analyst (two-way)** — `buildQAPrompt` + a free-form box (with quick
  chips). Answers grounded ONLY in the live data block; deterministic
  `fallbackAnswer` handles no-key/error/429 with keyword + club detection (title
  chances, top scorer, why-won/lost via xG, form) citing real numbers.
- **Prediction + accuracy tracker** — `predictMatchday` (the analyst's model call
  from xG, pre-reveal) + `deriveAnalystRecord` (graded vs actual outcome, pure
  over results). Shows the upcoming-matchday call and a season record "X/12
  correct" with ✓/✗ ticks; reproducible, works with no key, recomputes on edits.
- New RNG: none (analyst is derivation + I/O only). All new derivations pure.

**Verified.** `npm run verify`: record 5/12, MD1 call printed, sim framing present
in both system prompts + tactical + QA prompts, fallback read cites win-prob, and
grounded fallback answers ("Barça… 10% chance, 4th on 4 pts… magic number 6";
"Bellingham leads the Golden Boot with 3"). Browser (Playwright + Edge, 12/12):
offline read cites win-prob; record tallies (2/6 → 5/12); upcoming MD call shown;
offline Q&A grounded + tagged; **live read + Q&A render from Gemini (mocked)** and
the **QA prompt carries SIMULATED framing + win% + Golden Boot grounding**; 0
errors. `npm run build` clean.

---

## Phase 11 — Final skin + broadcast moments (G5) (2026-06-29)

The visual finish. Restraint over decoration; the mandatory core stays the
visually primary hero, with secondary features in tabs.

- **Iconic palette, applied with discipline.** Ink page/surfaces; **cyan `#2BE8FF`
  is the only brand accent** (LIVE dot, active tab, buttons, scrubber, focus,
  What-If, derby badge, analyst accents); **gold `#F2C94C` reserved for the #1 row
  + champion moment only** (audited out of the whistle button, FT badge, MOTM,
  points column, sim/season tags, etc.); win/loss greens/reds for form/deltas/
  momentum; **team kit colours only in rows/crests/momentum**, never chrome (the
  page glow is now a single restrained cyan, no blue/green leaks).
- **Momentum broadcast wave** (`MomentumWave`, pure SVG): G1's signed series as a
  flowing two-colour area — home above the centreline, away below — with
  goal-event markers on their minutes (Catmull-Rom smoothing, gradient fills).
- **Tabbed secondary area** (`SecondaryTabs`, post-load): **Stats** (Boot/Assists/
  Glove), **Tables** (Home/Away/Form/xG toggle), **Match** (fixture picker →
  momentum wave + 0-90' timeline + player ratings by band, MOTM flagged),
  **Season** (position-worm line chart, 1 at top, one line per club in kit colour).
- **Rivalries** (`data/rivalries.ts`, extensible; analyst reuses it): RMA vs FCB →
  **El Clásico** badge + heightened scoreboard framing; non-rivals → nothing.
- **Broadcast moments:** referee-whistle SFX on Final Whistle + crowd roar on lead
  change (Web Audio, synthesized, **mute toggle**); count-up scores; FLIP; and on
  clinch a gold **CHAMPIONS** lower-third + confetti canvas + pulsing winning row.
  Magic-number line shows before clinch.
- **Responsive:** fixed the control-actions wrap (mobile overflow) — flawless at
  390px (tabs usable, wave/timeline/worm reflow, table scrolls in-panel).
- **Docs/deploy:** README rewritten (features, palette + rules, sim framing +
  SQUAD_SNAPSHOT_DATE, crest/Wikimedia attribution, two-way analyst, exact deploy
  commands + URL); OVERVIEW refreshed. Confirmed `vite base '/FIFA_HACKUP26_QF/'`
  and relative crest paths (load under the base on Pages).

**Verified:** `npm run verify` ✅ (all engine/analytics invariants green).
`npm run build` clean. Browser (Playwright + Edge, **19/19**): hero primary +
tabs work; LIVE dot cyan; leader points gold while non-leader points are not
(gold discipline); momentum wave + 4 goal markers; ratings with one MOTM; Tables
toggle; worm = one line/club; Stats leaderboards; **El Clásico framing fires**;
**CHAMPIONS moment + confetti names Real Madrid** on the final day; **0 horizontal
overflow on mobile** + wave renders in-tab; 0 console errors.

**Status:** all phases complete — broadcast-grade, palette-disciplined, fully
responsive, deploy-ready.

**Palette v2 (2026-06-29):** swapped only the theme token values — desaturated broadcast palette (graphite ink/surfaces, platinum `#CBD5E1` as the sole chrome accent, gold `#E8C766` still reserved for leader/champion, win `#3FA86E` / loss `#C5544B`); no layout/structure/component/animation/SFX/logic changes. Drop-in: cyan/neon removed from chrome (verified 0 hits), gold-on-champion + team-colour momentum wave intact; build clean.
