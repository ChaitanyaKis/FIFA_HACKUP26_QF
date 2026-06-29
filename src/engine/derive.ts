// Analytics layer. EVERYTHING here is a PURE FUNCTION of a results array (the
// enriched match-log), so a What-If editor can recompute it all on edited
// results. No new event generation; the only randomness is the Monte Carlo in
// `monteCarloTitleOdds` (seeded for reproducibility, independent of the season
// SEED). Additive — nothing in the core engine changes.

import type { MatchResult, StandingsRow, Club, Player } from '../data/types.ts';
import { computeStandings } from './engine.ts';
import type { ClubRating } from '../sim/ratings.ts';
import { RATINGS, DEFAULT_RATING } from '../sim/ratings.ts';
import { expectedGoals, poisson, mulberry32 } from '../sim/engine.ts';

const maxMatchday = (results: MatchResult[]): number =>
  results.length ? Math.max(...results.map((m) => m.matchday)) : 0;

// ── 1. LEADERBOARDS ─────────────────────────────────────────────────────────

export interface ScorerStat {
  playerId: string;
  clubId: string;
  goals: number;
  matches: number; // fixtures the player featured in
  assists: number;
}

/** Golden Boot: goals desc, then fewer matches, then more assists. */
export function deriveGoldenBoot(results: MatchResult[]): ScorerStat[] {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  const club = new Map<string, string>();
  const matches = new Map<string, number>();

  for (const m of results) {
    for (const r of m.ratings) {
      matches.set(r.playerId, (matches.get(r.playerId) ?? 0) + 1);
      club.set(r.playerId, r.clubId);
    }
    for (const g of m.goalEvents) {
      goals.set(g.scorerId, (goals.get(g.scorerId) ?? 0) + 1);
      if (g.assistId) assists.set(g.assistId, (assists.get(g.assistId) ?? 0) + 1);
    }
  }

  return [...goals.keys()]
    .map((pid) => ({
      playerId: pid,
      clubId: club.get(pid) ?? '',
      goals: goals.get(pid) ?? 0,
      matches: matches.get(pid) ?? 0,
      assists: assists.get(pid) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        a.matches - b.matches ||
        b.assists - a.assists ||
        a.playerId.localeCompare(b.playerId),
    );
}

export interface AssistStat {
  playerId: string;
  clubId: string;
  assists: number;
  goals: number;
}

/** Assist race: assists desc, then goals, then matches-agnostic id tiebreak. */
export function deriveAssistRace(results: MatchResult[]): AssistStat[] {
  const assists = new Map<string, number>();
  const goals = new Map<string, number>();
  const club = new Map<string, string>();
  for (const m of results) {
    for (const r of m.ratings) club.set(r.playerId, r.clubId);
    for (const g of m.goalEvents) {
      goals.set(g.scorerId, (goals.get(g.scorerId) ?? 0) + 1);
      if (g.assistId) assists.set(g.assistId, (assists.get(g.assistId) ?? 0) + 1);
    }
  }
  return [...assists.keys()]
    .map((pid) => ({
      playerId: pid,
      clubId: club.get(pid) ?? '',
      assists: assists.get(pid) ?? 0,
      goals: goals.get(pid) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.assists - a.assists ||
        b.goals - a.goals ||
        a.playerId.localeCompare(b.playerId),
    );
}

export interface GloveStat {
  clubId: string;
  gkId: string | null;
  cleanSheets: number;
  ga: number;
}

/** Golden Glove: clean sheets per club, attributed to its first-choice GK. */
export function deriveGoldenGlove(
  results: MatchResult[],
  players: Player[],
): GloveStat[] {
  const cs = new Map<string, number>();
  const ga = new Map<string, number>();
  const seen = new Set<string>();
  for (const m of results) {
    seen.add(m.homeId);
    seen.add(m.awayId);
    ga.set(m.homeId, (ga.get(m.homeId) ?? 0) + m.awayGoals);
    ga.set(m.awayId, (ga.get(m.awayId) ?? 0) + m.homeGoals);
    if (m.awayGoals === 0) cs.set(m.homeId, (cs.get(m.homeId) ?? 0) + 1);
    if (m.homeGoals === 0) cs.set(m.awayId, (cs.get(m.awayId) ?? 0) + 1);
  }
  const gkOf = (clubId: string) =>
    players.find((p) => p.clubId === clubId && p.position === 'GK')?.id ?? null;

  return [...seen]
    .map((clubId) => ({
      clubId,
      gkId: gkOf(clubId),
      cleanSheets: cs.get(clubId) ?? 0,
      ga: ga.get(clubId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.cleanSheets - a.cleanSheets ||
        a.ga - b.ga ||
        a.clubId.localeCompare(b.clubId),
    );
}

// ── 2. ALTERNATE TABLES (reuse computeStandings via its options) ────────────

export function homeTable(results: MatchResult[], clubs: Club[]): StandingsRow[] {
  return computeStandings(results, clubs, { side: 'home' });
}
export function awayTable(results: MatchResult[], clubs: Club[]): StandingsRow[] {
  return computeStandings(results, clubs, { side: 'away' });
}
/** Form table over the last `n` matchdays (default 5). */
export function formTable(
  results: MatchResult[],
  clubs: Club[],
  n = 5,
): StandingsRow[] {
  const cutoff = maxMatchday(results) - n;
  return computeStandings(results, clubs, { filter: (m) => m.matchday > cutoff });
}
/** xG table: standings where each fixture is scored by xG (gd = cumulative xGF-xGA). */
export function xgTable(results: MatchResult[], clubs: Club[]): StandingsRow[] {
  return computeStandings(results, clubs, {
    scoreOf: (m) => ({ home: m.homeXG, away: m.awayXG }),
    round: 1,
  });
}

// ── 3. POSITION WORM ────────────────────────────────────────────────────────

export interface WormRow {
  clubId: string;
  positions: number[]; // league position (1-based) after matchday 1..N
}

/** Each club's position after every matchday — equals the real table at each point. */
export function derivePositionWorm(
  results: MatchResult[],
  clubs: Club[],
): WormRow[] {
  const total = maxMatchday(results);
  const byClub = new Map<string, number[]>(clubs.map((c) => [c.id, []]));
  for (let md = 1; md <= total; md++) {
    const standings = computeStandings(
      results.filter((m) => m.matchday <= md),
      clubs,
    );
    for (const row of standings) byClub.get(row.teamId)?.push(row.position);
  }
  return clubs.map((c) => ({ clubId: c.id, positions: byClub.get(c.id) ?? [] }));
}

// ── 4. TITLE CLINCH / MAGIC NUMBER ──────────────────────────────────────────

export interface ClinchInfo {
  matchday: number;
  leaderId: string;
  gamesLeft: number;
  clinched: boolean;
  magicNumber: number; // min further points to guarantee top on points
}
export interface TitleRace {
  perMatchday: ClinchInfo[];
  clinchedMatchday: number | null;
  championId: string | null;
}

/**
 * Per-matchday title-clinch (points-based, so it ignores GD swings — noted as a
 * simplification). A leader is clinched when its points exceed every chaser's
 * max possible (current + 3 × games left). With 0 games left the season is
 * complete, so whoever is top on the full tiebreak is champion — this is what
 * makes SEED 737 (level on points, decided on GD) clinch only on the final day.
 */
export function deriveTitleRace(
  results: MatchResult[],
  clubs: Club[],
): TitleRace {
  const total = maxMatchday(results);
  const per: ClinchInfo[] = [];
  let clinchedMatchday: number | null = null;

  for (let md = 1; md <= total; md++) {
    const standings = computeStandings(
      results.filter((m) => m.matchday <= md),
      clubs,
    );
    const leader = standings[0];
    const gamesLeft = total - md;
    let clinched: boolean;
    let magicNumber: number;

    if (gamesLeft === 0) {
      clinched = true; // season complete → top of full standings is champion
      magicNumber = 0;
    } else {
      const topChaserMax = Math.max(
        ...standings.slice(1).map((c) => c.points + 3 * gamesLeft),
      );
      clinched = leader.points > topChaserMax;
      magicNumber = Math.max(0, topChaserMax - leader.points + 1);
    }

    per.push({ matchday: md, leaderId: leader.teamId, gamesLeft, clinched, magicNumber });
    if (clinched && clinchedMatchday === null) clinchedMatchday = md;
  }

  const championId =
    clinchedMatchday !== null
      ? computeStandings(results, clubs)[0].teamId
      : null;
  return { perMatchday: per, clinchedMatchday, championId };
}

// ── 5. WIN-PROBABILITY (Monte Carlo) ────────────────────────────────────────

export interface MonteCarloOptions {
  runs?: number; // simulations (default 2000)
  mcSeed?: number; // fixed seed for reproducibility (NOT the season seed)
  ratings?: Record<string, ClubRating>;
}

/**
 * Title odds (% per club) by simulating the remaining fixtures `runs` times with
 * the same ratings/Poisson model and fresh draws. Pure over (current standings
 * from `played`, `remaining` fixtures, ratings). Converges to 100/0 once
 * `remaining` is empty.
 */
export function monteCarloTitleOdds(
  played: MatchResult[],
  remaining: MatchResult[],
  clubs: Club[],
  options: MonteCarloOptions = {},
): Record<string, number> {
  const runs = options.runs ?? 2000;
  const ratings = options.ratings ?? RATINGS;
  const rng = mulberry32((options.mcSeed ?? 0x5eed) >>> 0);
  const ratingOf = (id: string) => ratings[id] ?? DEFAULT_RATING;

  const ids = clubs.map((c) => c.id);
  const base = computeStandings(played, clubs);
  const baseById = new Map(base.map((r) => [r.teamId, r]));
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = 0;

  if (remaining.length === 0) {
    const champ = base[0]?.teamId;
    for (const id of ids) out[id] = id === champ ? 100 : 0;
    return out;
  }

  const wins = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let run = 0; run < runs; run++) {
    const pts = new Map<string, number>();
    const gf = new Map<string, number>();
    const ga = new Map<string, number>();
    for (const id of ids) {
      const r = baseById.get(id);
      pts.set(id, r?.points ?? 0);
      gf.set(id, r?.gf ?? 0);
      ga.set(id, r?.ga ?? 0);
    }
    for (const fx of remaining) {
      const h = ratingOf(fx.homeId);
      const a = ratingOf(fx.awayId);
      const hg = poisson(expectedGoals(h.attack, a.defense, true), rng);
      const ag = poisson(expectedGoals(a.attack, h.defense, false), rng);
      gf.set(fx.homeId, (gf.get(fx.homeId) ?? 0) + hg);
      ga.set(fx.homeId, (ga.get(fx.homeId) ?? 0) + ag);
      gf.set(fx.awayId, (gf.get(fx.awayId) ?? 0) + ag);
      ga.set(fx.awayId, (ga.get(fx.awayId) ?? 0) + hg);
      if (hg > ag) pts.set(fx.homeId, (pts.get(fx.homeId) ?? 0) + 3);
      else if (hg < ag) pts.set(fx.awayId, (pts.get(fx.awayId) ?? 0) + 3);
      else {
        pts.set(fx.homeId, (pts.get(fx.homeId) ?? 0) + 1);
        pts.set(fx.awayId, (pts.get(fx.awayId) ?? 0) + 1);
      }
    }
    const champ = [...ids].sort(
      (x, y) =>
        (pts.get(y) ?? 0) - (pts.get(x) ?? 0) ||
        ((gf.get(y) ?? 0) - (ga.get(y) ?? 0)) - ((gf.get(x) ?? 0) - (ga.get(x) ?? 0)) ||
        (gf.get(y) ?? 0) - (gf.get(x) ?? 0) ||
        x.localeCompare(y),
    )[0];
    wins.set(champ, (wins.get(champ) ?? 0) + 1);
  }

  for (const id of ids) out[id] = Math.round(((wins.get(id) ?? 0) / runs) * 100);
  return out;
}

// ── 6. ANALYST PREDICTIONS + ACCURACY ───────────────────────────────────────

export interface MatchPrediction {
  matchId: string;
  homeId: string;
  awayId: string;
  predHome: number;
  predAway: number;
  outcome: 'H' | 'D' | 'A';
}

/** The analyst's model-based forecast of a fixture, from its xG (pre-draw info). */
function predictOne(fx: MatchResult): MatchPrediction {
  const diff = fx.homeXG - fx.awayXG;
  const outcome: 'H' | 'D' | 'A' = Math.abs(diff) <= 0.2 ? 'D' : diff > 0 ? 'H' : 'A';
  let predHome = Math.round(fx.homeXG);
  let predAway = Math.round(fx.awayXG);
  // Keep the shown scoreline consistent with the predicted outcome.
  if (outcome === 'D' && predHome !== predAway) {
    const m = Math.max(predHome, predAway);
    predHome = m;
    predAway = m;
  }
  if (outcome === 'H' && predHome <= predAway) predHome = predAway + 1;
  if (outcome === 'A' && predAway <= predHome) predAway = predHome + 1;
  return { matchId: fx.id, homeId: fx.homeId, awayId: fx.awayId, predHome, predAway, outcome };
}

/** The analyst's predicted scorelines for a matchday (made from xG, pre-reveal). */
export function predictMatchday(results: MatchResult[], matchday: number): MatchPrediction[] {
  return results.filter((m) => m.matchday === matchday).map(predictOne);
}

export interface RecordFixture {
  matchId: string;
  predHome: number;
  predAway: number;
  actualHome: number;
  actualAway: number;
  correct: boolean; // predicted the right result (H/D/A)
}
export interface AnalystRecord {
  correct: number;
  total: number;
  fixtures: RecordFixture[];
}

const outcomeOf = (h: number, a: number): 'H' | 'D' | 'A' => (h > a ? 'H' : h < a ? 'A' : 'D');

/** Season-long prediction accuracy over the played matchdays (pure over results). */
export function deriveAnalystRecord(
  results: MatchResult[],
  playedMatchdays: number,
): AnalystRecord {
  const fixtures = results
    .filter((m) => m.matchday <= playedMatchdays)
    .map((m) => {
      const p = predictOne(m);
      return {
        matchId: m.id,
        predHome: p.predHome,
        predAway: p.predAway,
        actualHome: m.homeGoals,
        actualAway: m.awayGoals,
        correct: p.outcome === outcomeOf(m.homeGoals, m.awayGoals),
      };
    });
  return {
    correct: fixtures.filter((f) => f.correct).length,
    total: fixtures.length,
    fixtures,
  };
}

export interface WinProbPoint {
  matchday: number;
  odds: Record<string, number>;
}

/** Title odds recomputed after each matchday (converges to 100/0 at the end). */
export function deriveWinProbabilityByMatchday(
  results: MatchResult[],
  clubs: Club[],
  options: MonteCarloOptions = {},
): WinProbPoint[] {
  const total = maxMatchday(results);
  const points: WinProbPoint[] = [];
  for (let md = 1; md <= total; md++) {
    points.push({
      matchday: md,
      odds: monteCarloTitleOdds(
        results.filter((m) => m.matchday <= md),
        results.filter((m) => m.matchday > md),
        clubs,
        options,
      ),
    });
  }
  return points;
}
