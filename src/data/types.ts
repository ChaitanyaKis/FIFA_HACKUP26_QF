// Domain vocabulary for the league portal.
//
// ARCHITECTURE: `MatchResult[]` (the match-log) is the ONLY source of truth.
// `StandingsRow`, `MatchStats`, MOTM and the form guide are DERIVED types —
// they are produced by pure functions in the engine and are NEVER stored.

/** A competing club. Reference data, not derived. */
export interface Team {
  id: string;
  name: string;
  shortCode: string; // 3-letter broadcast abbreviation, e.g. "KES"
  color: string; // brand colour (hex), used for kit dots / bars
}

/** A squad member. Reference data, not derived. */
export interface Player {
  id: string;
  name: string;
  teamId: string;
}

/**
 * A single completed fixture — the atomic unit of the match-log.
 * Everything the portal displays is computed from a list of these.
 */
export interface MatchResult {
  id: string; // stable id, e.g. "md6-KES-VEL" (used for React keys & lookups)
  matchday: number; // 1-based round number
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  homeXG: number; // expected goals (home)
  awayXG: number; // expected goals (away)
  scorerIds: string[]; // player ids per goal: home scorers first, then away
  motmId: string; // man-of-the-match player id
  homeShots: number;
  awayShots: number;
  homePossession: number; // 0-100; away possession is the complement
}

/** Single-letter outcome from one team's perspective. */
export type FormResult = 'W' | 'D' | 'L';

/**
 * A derived standings row. NEVER persisted — always recomputed from the log,
 * which is what guarantees the table can never desync from the results.
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
  dominantId: string | null; // team with the xG edge, or null when balanced
  homeShare: number; // home share of total xG, 0-100
}

/** Derived man-of-the-match spotlight for one fixture (broadcast lower-third). */
export interface MotmSpotlight {
  player: Player;
  teamId: string;
  matchId: string;
  matchday: number;
  goals: number; // goals this player scored in the match
  teamXG: number; // their team's xG in the match
  opponentId: string;
  scoreline: string; // from the player's team perspective, e.g. "3-0"
  won: boolean;
}
