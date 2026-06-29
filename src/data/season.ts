// The SIMULATED match-log — the single source of truth for the whole portal.
//
// There are NO authored results here: the full season is GENERATED at module
// init by the simulation engine from a fixed SEED (sim/engine.ts), so it is
// reproducible yet emergent. Standings, stats, MOTM and form all derive from it.

import { clubs, players } from './clubs.ts';
import { simulateSeason, SEED } from '../sim/engine.ts';
import type { MatchResult } from './types.ts';

export const season: MatchResult[] = simulateSeason(
  SEED,
  clubs.map((c) => c.id),
  players,
);

export const TOTAL_MATCHDAYS = season.length
  ? Math.max(...season.map((m) => m.matchday))
  : 0;

export { SEED };
