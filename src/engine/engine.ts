// The derivation engine.
//
// PURE FUNCTIONS ONLY. No I/O, no mutation of inputs, no stored state, no
// randomness, no clock. Given the same match-log these always return the same
// derived views — which is exactly what keeps the table, stats, MOTM and form
// guide perfectly in sync with the results.

import type {
  MatchResult,
  Player,
  StandingsRow,
  MatchStats,
  TitleRaceState,
  Club,
  FormResult,
  Momentum,
  MotmSpotlight,
} from '../data/types.ts';

const WIN_POINTS = 3;
const DRAW_POINTS = 1;

// Internal mutable accumulator (never leaves this module).
interface Tally {
  teamId: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  form: FormResult[];
}

function emptyTally(teamId: string): Tally {
  return { teamId, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, form: [] };
}

/**
 * Options that parameterize the table without changing the default behavior.
 * Used by the analytics layer (engine/derive.ts) to build the Home/Away/Form/xG
 * tables by REUSING this one function instead of duplicating the accumulation.
 */
export interface StandingsOptions {
  /** Restrict to a subset of fixtures (e.g. last N matchdays). */
  filter?: (m: MatchResult) => boolean;
  /** Credit only the home club, only the away club, or both (default). */
  side?: 'both' | 'home' | 'away';
  /** Map a fixture to its scoreline (default = actual goals; xG table uses xG). */
  scoreOf?: (m: MatchResult) => { home: number; away: number };
  /** Round gf/ga/gd to this many dp (for the decimal xG table). */
  round?: number | null;
}

function roundTo(n: number, dp: number | null | undefined): number {
  if (dp === null || dp === undefined) return n;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Derive the league table from the match-log.
 *
 * Sorted by points -> goal difference -> goals for, with a stable teamId
 * tiebreak so the order is fully deterministic. Pass `clubs` to also seed rows
 * for clubs that have not played yet. `options` (filter/side/scoreOf/round) is a
 * purely additive parameterization — calling with two args is unchanged.
 */
export function computeStandings(
  results: MatchResult[],
  clubs: Club[] = [],
  options: StandingsOptions = {},
): StandingsRow[] {
  const { filter, side = 'both', scoreOf, round = null } = options;
  const score =
    scoreOf ?? ((m: MatchResult) => ({ home: m.homeGoals, away: m.awayGoals }));

  const tallies = new Map<string, Tally>();
  const ensure = (id: string): Tally => {
    let t = tallies.get(id);
    if (!t) {
      t = emptyTally(id);
      tallies.set(id, t);
    }
    return t;
  };

  // Seed every known club so 0-game clubs still appear.
  for (const club of clubs) ensure(club.id);

  const credit = (t: Tally, gf: number, ga: number) => {
    t.played++;
    t.gf += gf;
    t.ga += ga;
    if (gf > ga) {
      t.w++;
      t.form.push('W');
    } else if (gf < ga) {
      t.l++;
      t.form.push('L');
    } else {
      t.d++;
      t.form.push('D');
    }
  };

  // Apply results in chronological order so `form` reads oldest -> newest.
  const ordered = [...results]
    .filter((m) => (filter ? filter(m) : true))
    .sort((a, b) => a.matchday - b.matchday);
  for (const m of ordered) {
    const { home: hs, away: as_ } = score(m);
    if (side !== 'away') credit(ensure(m.homeId), hs, as_);
    if (side !== 'home') credit(ensure(m.awayId), as_, hs);
  }

  const rows: StandingsRow[] = [...tallies.values()].map((t) => ({
    teamId: t.teamId,
    played: t.played,
    w: t.w,
    d: t.d,
    l: t.l,
    gf: roundTo(t.gf, round),
    ga: roundTo(t.ga, round),
    gd: roundTo(t.gf - t.ga, round),
    points: t.w * WIN_POINTS + t.d * DRAW_POINTS,
    form: [...t.form], // own copy — never alias the internal accumulator
    position: 0,
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.teamId.localeCompare(b.teamId),
  );
  rows.forEach((row, i) => {
    row.position = i + 1;
  });

  return rows;
}

/** Derive the comparison-bar analytics for a single match. */
export function computeMatchStats(result: MatchResult): MatchStats {
  return {
    possession: {
      home: result.homePossession,
      away: 100 - result.homePossession,
    },
    shots: { home: result.homeShots, away: result.awayShots },
    xg: { home: result.homeXG, away: result.awayXG },
  };
}

/**
 * Resolve the man of the match for a result.
 *
 * Prefers the explicit `motmId`. If that is missing/invalid, falls back to a
 * deterministic heuristic: a scorer from the winning side, else the first
 * scorer of the match. Returns null only when nothing can be resolved.
 */
export function pickMOTM(
  result: MatchResult,
  players: Player[],
): Player | null {
  const byId = new Map(players.map((p) => [p.id, p]));

  const explicit = byId.get(result.motmId);
  if (explicit) return explicit;

  const winnerId =
    result.homeGoals > result.awayGoals
      ? result.homeId
      : result.awayGoals > result.homeGoals
        ? result.awayId
        : null;

  if (winnerId) {
    const winningScorer = result.scorerIds
      .map((id) => byId.get(id))
      .find((p): p is Player => p?.clubId === winnerId);
    if (winningScorer) return winningScorer;
  }

  const anyScorer = result.scorerIds
    .map((id) => byId.get(id))
    .find((p): p is Player => Boolean(p));
  return anyScorer ?? null;
}

/** Derive the title-race headline from an already-sorted standings list. */
export function titleRaceState(standings: StandingsRow[]): TitleRaceState {
  if (standings.length === 0) return { leaderId: null, gapToSecond: 0 };
  const leader = standings[0];
  const second = standings[1];
  return {
    leaderId: leader.teamId,
    gapToSecond: second ? leader.points - second.points : 0,
  };
}

/** xG-swing threshold below which a fixture is read as "balanced". */
const MOMENTUM_BALANCED = 0.25;

/**
 * Derive a fixture's momentum from the xG swing in the log. Positive swing =
 * the home side carried the play; negative = the away side. Pure.
 */
export function computeMomentum(result: MatchResult): Momentum {
  const swingRaw = result.homeXG - result.awayXG;
  const total = result.homeXG + result.awayXG;
  const homeShare = total === 0 ? 50 : (result.homeXG / total) * 100;
  const dominantId =
    swingRaw > MOMENTUM_BALANCED
      ? result.homeId
      : swingRaw < -MOMENTUM_BALANCED
        ? result.awayId
        : null;
  return {
    swing: Math.round(swingRaw * 10) / 10,
    dominantId,
    homeShare,
  };
}

/** Derive the MOTM spotlight (player + key stat line) for a single fixture. */
export function motmForMatch(
  result: MatchResult,
  players: Player[],
): MotmSpotlight | null {
  const player = pickMOTM(result, players);
  if (!player) return null;

  const isHome = player.clubId === result.homeId;
  const teamGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;

  return {
    player,
    teamId: player.clubId,
    matchId: result.id,
    matchday: result.matchday,
    goals: result.scorerIds.filter((id) => id === player.id).length,
    teamXG: isHome ? result.homeXG : result.awayXG,
    opponentId: isHome ? result.awayId : result.homeId,
    scoreline: `${teamGoals}-${oppGoals}`,
    won: teamGoals > oppGoals,
  };
}

/**
 * Derive the standout MOTM across a matchday's fixtures — the spotlight for the
 * lower-third. Ranked by goals, then team xG, then a win, with a deterministic
 * matchId tiebreak.
 */
export function pickMatchdayMOTM(
  results: MatchResult[],
  players: Player[],
  matchday: number,
): MotmSpotlight | null {
  const spotlights = results
    .filter((r) => r.matchday === matchday)
    .map((r) => motmForMatch(r, players))
    .filter((s): s is MotmSpotlight => s !== null);

  if (spotlights.length === 0) return null;

  return [...spotlights].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.teamXG - a.teamXG ||
      Number(b.won) - Number(a.won) ||
      a.matchId.localeCompare(b.matchId),
  )[0];
}
