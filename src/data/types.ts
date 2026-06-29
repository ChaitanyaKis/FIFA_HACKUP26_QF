// Domain vocabulary for the league portal.
//
// ARCHITECTURE: `MatchResult[]` (the SIMULATED match-log) is the ONLY source of
// truth. `StandingsRow`, `MatchStats`, MOTM and the form guide are DERIVED types
// — produced by pure functions in the engine and NEVER stored. The match-log
// itself is produced by the simulation engine (sim/engine.ts) from a fixed SEED.

/** A competing club. Reference data, not derived. */
export interface Club {
  id: string;
  name: string;
  shortCode: string; // 3-letter broadcast abbreviation, e.g. "RMA"
  primaryColor: string; // main kit hex
  secondaryColor: string; // a distinct accent hex (keeps same-color clubs apart)
  crest?: string; // public path (relative to BASE_URL); monogram fallback if absent
}

/** Squad position group — drives scorer probability in the simulation. */
export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';

/** One goal, attached to a goal already sampled (never re-samples totals). */
export interface GoalEvent {
  minute: number; // 1-90, or 91-95 for stoppage time
  clubId: string; // scoring club
  scorerId: string;
  assistId: string | null;
}

/** A booking. A red also marks the player off for the rest of that match. */
export interface CardEvent {
  minute: number;
  clubId: string;
  playerId: string;
  type: 'yellow' | 'red';
}

/** A featured player's match rating (4.0-10.0, 1dp). */
export interface PlayerRating {
  playerId: string;
  clubId: string;
  rating: number;
}

/** A squad member. Reference data, not derived. */
export interface Player {
  id: string;
  name: string;
  clubId: string;
  position: PlayerPosition;
}

/**
 * A single completed fixture — the atomic unit of the match-log. Produced by the
 * simulation; everything the portal displays is computed from a list of these.
 */
export interface MatchResult {
  id: string; // stable id, e.g. "md6-RMA-BAY" (used for React keys & lookups)
  matchday: number; // 1-based round number
  homeId: string;
  awayId: string;
  homeGoals: number; // actual goals — a Poisson draw on the xG
  awayGoals: number;
  homeXG: number; // expected goals (the Poisson lambda)
  awayXG: number;
  scorerIds: string[]; // player ids per goal: home scorers first, then away
  motmId: string; // man-of-the-match player id (== top-rated player of the fixture)
  homeShots: number;
  awayShots: number;
  homePossession: number; // 0-100; away possession is the complement
  // ── Enriched, internally-consistent detail (attached to sampled goals) ──
  goalEvents: GoalEvent[]; // one per goal; Σ per club == that club's goal count
  sot: { home: number; away: number }; // shots on target: goals ≤ sot ≤ totalShots
  cards: CardEvent[];
  ratings: PlayerRating[]; // every featured player
  momentum: number[]; // signed per-5-min series; + = home dominance
  suspended: string[]; // player ids ineligible (suspended) for this fixture
}

/** Single-letter outcome from one club's perspective. */
export type FormResult = 'W' | 'D' | 'L';

/**
 * A derived standings row. NEVER persisted — always recomputed from the log,
 * which is what guarantees the table can never desync from the results.
 * `teamId` holds the club id (kept stable so computeStandings is unchanged).
 */
export interface StandingsRow {
  teamId: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number; // goals for
  ga: number; // goals against
  gd: number; // goal difference (gf - ga)
  points: number;
  form: FormResult[]; // chronological, oldest -> newest
  position: number; // 1-based rank after sorting
}

/** Derived per-match analytics, shaped for the comparison bars. */
export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  xg: { home: number; away: number };
}

/** Derived snapshot of who leads and by how much. */
export interface TitleRaceState {
  leaderId: string | null;
  gapToSecond: number; // points clear of 2nd; 0 if fewer than 2 teams
}

/** Derived per-fixture momentum read from the xG swing in the log. */
export interface Momentum {
  swing: number; // homeXG - awayXG, rounded to 1dp (+ = home, − = away)
  dominantId: string | null; // club with the xG edge, or null when balanced
  homeShare: number; // home share of total xG, 0-100
}

/** Derived man-of-the-match spotlight for one fixture (broadcast lower-third). */
export interface MotmSpotlight {
  player: Player;
  teamId: string; // the player's club id
  matchId: string;
  matchday: number;
  goals: number; // goals this player scored in the match
  teamXG: number; // their club's xG in the match
  opponentId: string;
  scoreline: string; // from the player's club perspective, e.g. "3-0"
  won: boolean;
}
