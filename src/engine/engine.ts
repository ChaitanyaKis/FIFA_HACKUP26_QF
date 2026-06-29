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
  Team,
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
 * Derive the league table from the match-log.
 *
 * Sorted by points -> goal difference -> goals for, with a stable teamId
 * tiebreak so the order is fully deterministic. Pass `teams` to also seed rows
 * for clubs that have not played yet (so the table shows all 4 before kickoff).
 */
export function computeStandings(
  results: MatchResult[],
  teams: Team[] = [],
): StandingsRow[] {
  const tallies = new Map<string, Tally>();
  const ensure = (id: string): Tally => {
    let t = tallies.get(id);
    if (!t) {
      t = emptyTally(id);
      tallies.set(id, t);
    }
    return t;
  };

  // Seed every known team so 0-game clubs still appear.
  for (const team of teams) ensure(team.id);

  // Apply results in chronological order so `form` reads oldest -> newest.
  const ordered = [...results].sort((a, b) => a.matchday - b.matchday);
  for (const m of ordered) {
    const home = ensure(m.homeId);
    const away = ensure(m.awayId);

    home.played++;
    away.played++;
    home.gf += m.homeGoals;
    home.ga += m.awayGoals;
    away.gf += m.awayGoals;
    away.ga += m.homeGoals;

    if (m.homeGoals > m.awayGoals) {
      home.w++;
      away.l++;
      home.form.push('W');
      away.form.push('L');
    } else if (m.homeGoals < m.awayGoals) {
      away.w++;
      home.l++;
      away.form.push('W');
      home.form.push('L');
    } else {
      home.d++;
      away.d++;
      home.form.push('D');
      away.form.push('D');
    }
  }

  const rows: StandingsRow[] = [...tallies.values()].map((t) => ({
    teamId: t.teamId,
    played: t.played,
    w: t.w,
    d: t.d,
    l: t.l,
    gf: t.gf,
    ga: t.ga,
    gd: t.gf - t.ga,
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
      .find((p): p is Player => p?.teamId === winnerId);
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

  const isHome = player.teamId === result.homeId;
  const teamGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;

  return {
    player,
    teamId: player.teamId,
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
