# League Standings Leaderboard & Live Performance Analytics Portal

A broadcast-style portal tracking 4 fictional teams: live standings + performance analytics.

## Grading rubric (100 pts)
- UI/UX — 25
- Core Features — 25
- Interactive Logic — 35
- Creative Feature — 15

## CORE ARCHITECTURE RULE (non-negotiable)
A single **match-log** is the ONLY source of truth. Standings, match stats, MOTM,
and the W/D/L form guide are ALL **derived** via pure functions — never stored.
Derived state is never persisted or duplicated. This guarantees the table and the
stats can never desync: change the log, everything recomputes.

## Fictional-data note
Every team, player, and result is invented. No real clubs, people, or leagues —
zero reference to actual football entities, anywhere.

## Stack
- React + TypeScript + Vite
- framer-motion (animations, FLIP reorder)
- Raw `fetch` to the Google Gemini API, model `gemini-3.5-flash` (no SDK)
- In-memory React state only — **NO localStorage / persistence** (API key too)

## Build order (phased)
1. Data model + derivation engine (pure functions, the heart of the app)
2. "Final Whistle" submit flow + FLIP standings reorder
3. MOTM selection + analytics depth
4. AI Performance Analyst (Gemini `gemini-3.5-flash`) + deterministic fallback
5. Polish + README + deploy (GitHub Pages)

## Conventions
- Pure derivation lives apart from UI; components read derived views, never mutate them.
- `vite.config.ts` `base` must equal the deployed repo name.
- Log every phase in `docs/BUILD_LOG.md` (append-only).
