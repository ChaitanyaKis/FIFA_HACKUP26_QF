// The match-simulation engine. Generates the ENTIRE season's match-log from one
// SEED — fully reproducible, no external deps. Results are emergent, not authored.
//
// THREE labelled, independent RNG streams keep concerns isolated so enrichment
// can never disturb the sampled goal totals / standings:
//   1) rng       — match OUTCOMES: goal totals (Poisson on xG), possession, shots
//   2) scorerRng — CREDITS: which eligible player scores / assists
//   3) eventRng  — EVENT DETAIL: minutes, cards, shots-on-target, ratings, momentum
// Goal totals depend ONLY on stream 1, so they are identical regardless of squads,
// cards or suspensions — enrichment is purely additive.

import type {
  MatchResult,
  Player,
  PlayerPosition,
  GoalEvent,
  CardEvent,
  PlayerRating,
} from '../data/types.ts';
import {
  RATINGS,
  BASE_DEFENSE,
  HOME_ADVANTAGE,
  DEFAULT_RATING,
} from './ratings.ts';

/**
 * The one seed that drives the whole season. Change it → a different season.
 * 737 was seed-selected for the best EMERGENT title race: 5 lead changes
 * (MUN→RMA→MUN→RMA→BAY→RMA) and the top three within a point on the final day,
 * decided on goal difference. Not authored — every result is a model draw.
 */
export const SEED = 737;

/** Deterministic PRNG (mulberry32) — returns a function yielding [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Knuth's Poisson sampler. */
export function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function ratingOf(clubId: string) {
  return RATINGS[clubId] ?? DEFAULT_RATING;
}

/** Expected goals (the Poisson lambda) for one side of a fixture. */
export function expectedGoals(attack: number, oppDefense: number, isHome: boolean): number {
  const lambda = attack * (BASE_DEFENSE / oppDefense) * (isHome ? HOME_ADVANTAGE : 1);
  return clamp(lambda, 0.2, 4);
}

const SCORER_WEIGHT: Record<PlayerPosition, number> = { FW: 5, MF: 2.5, DF: 0.8, GK: 0 };
const ASSIST_WEIGHT: Record<PlayerPosition, number> = { FW: 3, MF: 4, DF: 1, GK: 0 };
const BOOKING_WEIGHT: Record<PlayerPosition, number> = { FW: 1, MF: 2, DF: 3, GK: 0.4 };

function pickWeighted(
  pool: Player[],
  weightOf: (p: Player) => number,
  rng: () => number,
): Player | null {
  const total = pool.reduce((s, p) => s + Math.max(0, weightOf(p)), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const p of pool) {
    r -= Math.max(0, weightOf(p));
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

/** A goal minute in 1-90, with ~8% in stoppage (91-95). */
function drawMinute(rng: () => number): number {
  const base = 1 + Math.floor(rng() * 90);
  if (rng() < 0.08) return 90 + 1 + Math.floor(rng() * 5);
  return base;
}

/** Standard double round-robin for 4 clubs (each ordered pair once, 6 rounds). */
function buildSchedule(ids: string[]): Array<{ md: number; home: string; away: string }> {
  const baseRounds: Array<Array<[number, number]>> = [
    [[0, 1], [2, 3]],
    [[0, 2], [3, 1]],
    [[0, 3], [1, 2]],
  ];
  const out: Array<{ md: number; home: string; away: string }> = [];
  let md = 1;
  for (const round of baseRounds) {
    for (const [h, a] of round) out.push({ md, home: ids[h], away: ids[a] });
    md++;
  }
  for (const round of baseRounds) {
    for (const [h, a] of round) out.push({ md, home: ids[a], away: ids[h] });
    md++;
  }
  return out;
}

const NUM_BUCKETS = 18; // 5-minute buckets over 0-90'
const BUCKET = 5;

/**
 * Per-fixture momentum series (signed; + = home dominance). Built from the xG
 * differential + bounded noise + a Gaussian surge around each goal minute, then
 * smoothed. A constant offset guarantees the integral sign matches the xG edge,
 * so the higher-xG side always has the larger positive area (asserted in verify).
 */
function buildMomentum(
  homeId: string,
  homeXG: number,
  awayXG: number,
  goalEvents: GoalEvent[],
  rng: () => number,
): number[] {
  const diff = homeXG - awayXG;
  const raw: number[] = [];
  for (let b = 0; b < NUM_BUCKETS; b++) {
    const mid = b * BUCKET + BUCKET / 2;
    let surge = 0;
    for (const g of goalEvents) {
      const side = g.clubId === homeId ? 1 : -1;
      const d = mid - g.minute;
      surge += side * 14 * Math.exp(-(d * d) / (2 * 36));
    }
    raw.push(diff * 10 + (rng() * 2 - 1) * 6 + surge);
  }
  // 3-point smoothing.
  const v = raw.map((_, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(raw.length - 1, i + 1)];
    return (a + b + c) / 3;
  });
  // Guarantee the integral sign matches the xG edge, with the size of the
  // momentum-area lead scaled to the size of the xG edge (homeArea-awayArea == Σv).
  if (diff !== 0) {
    const sum = v.reduce((s, x) => s + x, 0);
    const sign = diff > 0 ? 1 : -1;
    const targetSum = sign * Math.max(3, Math.abs(diff) * 40);
    const offset = (targetSum - sum) / NUM_BUCKETS;
    for (let i = 0; i < v.length; i++) v[i] += offset;
  }
  return v.map(round1);
}

interface EnrichInput {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  homeXG: number;
  awayXG: number;
  homeShots: number; // already guaranteed ≥ homeGoals by the caller
  awayShots: number;
  homeEligible: Player[]; // squad minus players suspended for this fixture
  awayEligible: Player[];
  forcedHomeScorers?: string[]; // optional What-If override (per home goal)
  forcedAwayScorers?: string[];
}

interface EnrichOutput {
  scorerIds: string[];
  goalEvents: GoalEvent[];
  sot: { home: number; away: number };
  cards: CardEvent[];
  ratings: PlayerRating[];
  motmId: string;
  momentum: number[];
}

/**
 * Build the internally-consistent event detail for a fixture whose goal totals
 * are already fixed. Pure given the two rng streams. Shared by simulateSeason
 * (fresh season) and reEnrichFixture (What-If edits) so the logic isn't
 * duplicated. With no forced scorers this reproduces the season exactly.
 */
function enrichFixture(
  input: EnrichInput,
  scorerRng: () => number,
  eventRng: () => number,
): EnrichOutput {
  const {
    homeId,
    awayId,
    homeGoals,
    awayGoals,
    homeXG,
    awayXG,
    homeShots,
    awayShots,
    homeEligible,
    awayEligible,
    forcedHomeScorers,
    forcedAwayScorers,
  } = input;

  // ── Credits (scorers + assists), eligible pool, GK never scores ──
  const scorerIds: string[] = [];
  const goalEvents: GoalEvent[] = [];
  const creditGoal = (
    clubId: string,
    eligible: Player[],
    forced: string[] | undefined,
    i: number,
  ) => {
    const forcedId = forced?.[i];
    let scorerId: string;
    if (forcedId && eligible.some((p) => p.id === forcedId && p.position !== 'GK')) {
      scorerId = forcedId;
    } else {
      const scorer = pickWeighted(eligible, (p) => SCORER_WEIGHT[p.position], scorerRng);
      scorerId = scorer ? scorer.id : (eligible[0]?.id ?? '');
    }
    scorerIds.push(scorerId);
    let assistId: string | null = null;
    if (scorerRng() < 0.65) {
      const pool = eligible.filter((p) => p.id !== scorerId && p.position !== 'GK');
      const a = pickWeighted(pool, (p) => ASSIST_WEIGHT[p.position], scorerRng);
      assistId = a ? a.id : null;
    }
    goalEvents.push({ minute: drawMinute(eventRng), clubId, scorerId, assistId });
  };
  for (let g = 0; g < homeGoals; g++) creditGoal(homeId, homeEligible, forcedHomeScorers, g);
  for (let g = 0; g < awayGoals; g++) creditGoal(awayId, awayEligible, forcedAwayScorers, g);
  goalEvents.sort((a, b) => a.minute - b.minute);

  // ── Shots on target (goals ≤ sot ≤ totalShots) ──
  const sotOf = (goals: number, shots: number) =>
    clamp(Math.round(goals + (shots - goals) * (0.3 + 0.25 * eventRng())), goals, shots);
  const sot = { home: sotOf(homeGoals, homeShots), away: sotOf(awayGoals, awayShots) };

  // ── Cards (yellows common, red rare) ──
  const both = [...homeEligible, ...awayEligible];
  const cards: CardEvent[] = [];
  let nY = 1;
  if (eventRng() < 0.85) nY++;
  if (eventRng() < 0.6) nY++;
  if (eventRng() < 0.35) nY++;
  if (eventRng() < 0.15) nY++;
  for (let i = 0; i < nY; i++) {
    const p = pickWeighted(both, (x) => BOOKING_WEIGHT[x.position], eventRng);
    if (!p) break;
    cards.push({ minute: drawMinute(eventRng), clubId: p.clubId, playerId: p.id, type: 'yellow' });
  }
  if (eventRng() < 0.12) {
    const scored = new Set(scorerIds);
    const redPool = both.filter((x) => !scored.has(x.id));
    const p = pickWeighted(redPool.length ? redPool : both, (x) => BOOKING_WEIGHT[x.position], eventRng);
    if (p) cards.push({ minute: drawMinute(eventRng), clubId: p.clubId, playerId: p.id, type: 'red' });
  }

  // ── Player ratings (every featured player) ──
  const goalsBy = new Map<string, number>();
  const assistsBy = new Map<string, number>();
  for (const g of goalEvents) {
    goalsBy.set(g.scorerId, (goalsBy.get(g.scorerId) ?? 0) + 1);
    if (g.assistId) assistsBy.set(g.assistId, (assistsBy.get(g.assistId) ?? 0) + 1);
  }
  const yellowsBy = new Map<string, number>();
  const redSet = new Set<string>();
  for (const c of cards) {
    if (c.type === 'red') redSet.add(c.playerId);
    else yellowsBy.set(c.playerId, (yellowsBy.get(c.playerId) ?? 0) + 1);
  }
  const ratings: PlayerRating[] = both.map((p) => {
    const conceded = p.clubId === homeId ? awayGoals : homeGoals;
    let r = 6.5 + (goalsBy.get(p.id) ?? 0) * 0.85 + (assistsBy.get(p.id) ?? 0) * 0.45;
    if (p.position === 'GK' || p.position === 'DF') {
      r += conceded === 0 ? 0.6 : -Math.min(1, conceded * 0.18);
    }
    r -= (yellowsBy.get(p.id) ?? 0) * 0.3 + (redSet.has(p.id) ? 1.5 : 0);
    r += eventRng() * 1 - 0.5;
    return { playerId: p.id, clubId: p.clubId, rating: clamp(round1(r), 4, 10) };
  });

  // MOTM == top-rated featured player (tie: goals, then goals+assists, then id).
  const motm = [...ratings].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    const ga = goalsBy.get(a.playerId) ?? 0;
    const gb = goalsBy.get(b.playerId) ?? 0;
    if (gb !== ga) return gb - ga;
    const ca = ga + (assistsBy.get(a.playerId) ?? 0);
    const cb = gb + (assistsBy.get(b.playerId) ?? 0);
    if (cb !== ca) return cb - ca;
    return a.playerId.localeCompare(b.playerId);
  })[0];

  const momentum = buildMomentum(homeId, homeXG, awayXG, goalEvents, eventRng);

  return {
    scorerIds,
    goalEvents,
    sot,
    cards,
    ratings,
    motmId: motm ? motm.playerId : '',
    momentum,
  };
}

/** FNV-1a string hash → 32-bit, for deterministic per-edit seeding. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Re-derive a fixture's consistent detail for a What-If edit: the user sets the
 * scoreline (and optionally the scorers); everything else (sot, cards, ratings,
 * MOTM, momentum) is regenerated so all invariants still hold. Deterministic for
 * a given (fixture, scoreline) so the edit is stable. xG/possession are unchanged
 * (the chance quality didn't change — only the finishing did).
 */
export function reEnrichFixture(
  base: MatchResult,
  newHomeGoals: number,
  newAwayGoals: number,
  players: Player[],
  opts: { homeScorers?: string[]; awayScorers?: string[] } = {},
): MatchResult {
  const suspended = new Set(base.suspended);
  const eligibleOf = (clubId: string) =>
    players.filter((p) => p.clubId === clubId && !suspended.has(p.id));
  const homeShots = clamp(Math.max(base.homeShots, newHomeGoals), 3, 28);
  const awayShots = clamp(Math.max(base.awayShots, newAwayGoals), 3, 28);

  const seed = (hashStr(base.id) ^ (newHomeGoals * 131 + newAwayGoals * 17 + 1)) >>> 0;
  const scorerRng = mulberry32(seed);
  const eventRng = mulberry32((seed ^ 0x85ebca6b) >>> 0);

  const enriched = enrichFixture(
    {
      homeId: base.homeId,
      awayId: base.awayId,
      homeGoals: newHomeGoals,
      awayGoals: newAwayGoals,
      homeXG: base.homeXG,
      awayXG: base.awayXG,
      homeShots,
      awayShots,
      homeEligible: eligibleOf(base.homeId),
      awayEligible: eligibleOf(base.awayId),
      forcedHomeScorers: opts.homeScorers,
      forcedAwayScorers: opts.awayScorers,
    },
    scorerRng,
    eventRng,
  );

  return {
    ...base,
    homeGoals: newHomeGoals,
    awayGoals: newAwayGoals,
    homeShots,
    awayShots,
    ...enriched,
  };
}

/**
 * Simulate the full season deterministically from `seed`, processing matchdays
 * IN ORDER so card accumulation carries into later-matchday suspensions.
 * `players` assigns credits/ratings; standings depend only on `seed` + ratings.
 */
export function simulateSeason(
  seed: number,
  clubIds: string[],
  players: Player[],
): MatchResult[] {
  const rng = mulberry32(seed); // stream 1 — outcomes
  const scorerRng = mulberry32((seed ^ 0x9e3779b9) >>> 0); // stream 2 — credits
  const eventRng = mulberry32((seed ^ 0x85ebca6b) >>> 0); // stream 3 — detail

  const playerById = new Map<string, Player>(players.map((p) => [p.id, p]));
  const squads = new Map<string, Player[]>();
  for (const id of clubIds) squads.set(id, []);
  for (const p of players) squads.get(p.clubId)?.push(p);

  // Suspension state carried across matchdays.
  const yellowAccum = new Map<string, number>();
  const suspendedFor = new Map<number, Set<string>>();
  const banNext = (md: number, pid: string) => {
    const set = suspendedFor.get(md + 1) ?? new Set<string>();
    set.add(pid);
    suspendedFor.set(md + 1, set);
  };

  const schedule = buildSchedule(clubIds);
  const matchdays = [...new Set(schedule.map((f) => f.md))].sort((a, b) => a - b);
  const out: MatchResult[] = [];

  for (const md of matchdays) {
    const suspendedThisMd = suspendedFor.get(md) ?? new Set<string>();
    const eligibleOf = (clubId: string) =>
      (squads.get(clubId) ?? []).filter((p) => !suspendedThisMd.has(p.id));

    for (const fx of schedule.filter((f) => f.md === md)) {
      const home = ratingOf(fx.home);
      const away = ratingOf(fx.away);

      // ── STREAM 1 — outcomes (UNCHANGED order/quantity → byte-identical totals) ──
      const lambdaHome = expectedGoals(home.attack, away.defense, true);
      const lambdaAway = expectedGoals(away.attack, home.defense, false);
      const homeGoals = poisson(lambdaHome, rng);
      const awayGoals = poisson(lambdaAway, rng);
      const share = home.attack / (home.attack + away.attack);
      const homePossession = clamp(
        Math.round(50 + (share - 0.5) * 100 + 3 + (rng() * 8 - 4)),
        35,
        65,
      );
      // max(.., goals) guarantees goals ≤ shots for ANY seed (so goals ≤ sot ≤
      // shots always holds). It's a deterministic transform of the drawn value —
      // the rng draw count is unchanged, so goal totals stay byte-identical.
      const homeShots = clamp(Math.max(Math.round(lambdaHome * 5.5 + rng() * 4), homeGoals), 3, 28);
      const awayShots = clamp(Math.max(Math.round(lambdaAway * 5.5 + rng() * 4), awayGoals), 3, 28);
      const homeXG = round1(lambdaHome);
      const awayXG = round1(lambdaAway);

      const enriched = enrichFixture(
        {
          homeId: fx.home,
          awayId: fx.away,
          homeGoals,
          awayGoals,
          homeXG,
          awayXG,
          homeShots,
          awayShots,
          homeEligible: eligibleOf(fx.home),
          awayEligible: eligibleOf(fx.away),
        },
        scorerRng,
        eventRng,
      );

      // Accumulate cards → schedule next-match bans.
      for (const c of enriched.cards) {
        if (c.type === 'red') {
          banNext(md, c.playerId);
        } else {
          const acc = (yellowAccum.get(c.playerId) ?? 0) + 1;
          if (acc >= 2) {
            banNext(md, c.playerId);
            yellowAccum.set(c.playerId, 0);
          } else {
            yellowAccum.set(c.playerId, acc);
          }
        }
      }

      out.push({
        id: `md${md}-${fx.home}-${fx.away}`,
        matchday: md,
        homeId: fx.home,
        awayId: fx.away,
        homeGoals,
        awayGoals,
        homeXG,
        awayXG,
        homeShots,
        awayShots,
        homePossession,
        ...enriched,
        suspended: [...suspendedThisMd].filter((pid) => {
          const c = playerById.get(pid)?.clubId;
          return c === fx.home || c === fx.away;
        }),
      });
    }
  }

  return out;
}
