// The scripted demo season — the single source of truth for the whole portal.
//
// ALL teams, players and results below are FICTIONAL. No real clubs, players,
// leagues or results are referenced anywhere.
//
// NARRATIVE: Kestrel City (KES) are the UNDERDOG. The match-log is authored so
// that, recomputed matchday-by-matchday, KES climb 4th -> 3rd -> 3rd -> 2nd ->
// 2nd -> 1st, sealing the title on the final day in a head-to-head against the
// long-time leaders Vellmar Athletic (VEL). The intended table position after
// each matchday is commented inline; `npm run verify` proves it from the data.

import type { MatchResult, Player, Team } from './types.ts';

export const teams: Team[] = [
  { id: 'RID', name: 'Ridgeport Rovers', shortCode: 'RID', color: '#c8102e' }, // red
  { id: 'SOL', name: 'Solano United', shortCode: 'SOL', color: '#0a4ea2' }, // blue
  { id: 'VEL', name: 'Vellmar Athletic', shortCode: 'VEL', color: '#1f8a4c' }, // green
  { id: 'KES', name: 'Kestrel City', shortCode: 'KES', color: '#f4a300' }, // amber — UNDERDOG
];

export const players: Player[] = [
  // Ridgeport Rovers
  { id: 'RID-1', name: 'Marco Devlin', teamId: 'RID' },
  { id: 'RID-2', name: 'Tomas Rey', teamId: 'RID' },
  { id: 'RID-3', name: 'Aldric Penn', teamId: 'RID' },
  // Solano United
  { id: 'SOL-1', name: 'Nico Halvorsen', teamId: 'SOL' },
  { id: 'SOL-2', name: 'Emil Voss', teamId: 'SOL' },
  { id: 'SOL-3', name: 'Darian Cote', teamId: 'SOL' },
  // Vellmar Athletic
  { id: 'VEL-1', name: 'Sami Okafor', teamId: 'VEL' },
  { id: 'VEL-2', name: 'Luca Brandt', teamId: 'VEL' },
  { id: 'VEL-3', name: 'Pavel Ivankov', teamId: 'VEL' },
  // Kestrel City (underdog)
  { id: 'KES-1', name: 'Jonah Ferris', teamId: 'KES' },
  { id: 'KES-2', name: 'Kai Mwangi', teamId: 'KES' },
  { id: 'KES-3', name: 'Theo Salandro', teamId: 'KES' },
];

/** The id of the underdog whose climb is the demo narrative. */
export const UNDERDOG_ID = 'KES';

/**
 * The match-log. Authored, scripted, append-style. This array is the ONLY
 * mutable state the app cares about; everything else is derived from it.
 */
export const season: MatchResult[] = [
  // ── Matchday 1 ─────────────────────────────────────────────────────────
  // Table after MD1:  1.VEL  2.RID  3.SOL  4.KES   <- underdog bottom
  {
    id: 'md1-RID-SOL',
    matchday: 1,
    homeId: 'RID',
    awayId: 'SOL',
    homeGoals: 2,
    awayGoals: 1,
    homeXG: 2.1,
    awayXG: 0.9,
    scorerIds: ['RID-1', 'RID-1', 'SOL-1'],
    motmId: 'RID-1',
    homeShots: 14,
    awayShots: 8,
    homePossession: 55,
  },
  {
    id: 'md1-VEL-KES',
    matchday: 1,
    homeId: 'VEL',
    awayId: 'KES',
    homeGoals: 3,
    awayGoals: 0,
    homeXG: 2.8,
    awayXG: 0.4,
    scorerIds: ['VEL-1', 'VEL-1', 'VEL-2'],
    motmId: 'VEL-1',
    homeShots: 17,
    awayShots: 5,
    homePossession: 62,
  },

  // ── Matchday 2 ─────────────────────────────────────────────────────────
  // Table after MD2:  1.VEL  2.RID  3.KES  4.SOL   <- KES climbs to 3rd
  {
    id: 'md2-RID-VEL',
    matchday: 2,
    homeId: 'RID',
    awayId: 'VEL',
    homeGoals: 1,
    awayGoals: 2,
    homeXG: 1.3,
    awayXG: 1.9,
    scorerIds: ['RID-2', 'VEL-1', 'VEL-3'],
    motmId: 'VEL-1',
    homeShots: 11,
    awayShots: 13,
    homePossession: 48,
  },
  {
    id: 'md2-SOL-KES',
    matchday: 2,
    homeId: 'SOL',
    awayId: 'KES',
    homeGoals: 0,
    awayGoals: 2,
    homeXG: 1.4,
    awayXG: 1.5,
    scorerIds: ['KES-1', 'KES-2'],
    motmId: 'KES-1',
    homeShots: 13,
    awayShots: 9,
    homePossession: 58,
  },

  // ── Matchday 3 ─────────────────────────────────────────────────────────
  // Table after MD3:  1.VEL  2.RID  3.KES  4.SOL   <- KES holds 3rd
  {
    id: 'md3-RID-KES',
    matchday: 3,
    homeId: 'RID',
    awayId: 'KES',
    homeGoals: 1,
    awayGoals: 1,
    homeXG: 1.5,
    awayXG: 1.2,
    scorerIds: ['RID-1', 'KES-3'],
    motmId: 'KES-3',
    homeShots: 12,
    awayShots: 9,
    homePossession: 56,
  },
  {
    id: 'md3-SOL-VEL',
    matchday: 3,
    homeId: 'SOL',
    awayId: 'VEL',
    homeGoals: 0,
    awayGoals: 2,
    homeXG: 0.8,
    awayXG: 2.0,
    scorerIds: ['VEL-2', 'VEL-1'],
    motmId: 'VEL-2',
    homeShots: 7,
    awayShots: 15,
    homePossession: 45,
  },

  // ── Matchday 4 ─────────────────────────────────────────────────────────
  // Table after MD4:  1.VEL  2.KES  3.RID  4.SOL   <- KES up to 2nd
  {
    id: 'md4-VEL-RID',
    matchday: 4,
    homeId: 'VEL',
    awayId: 'RID',
    homeGoals: 1,
    awayGoals: 2,
    homeXG: 1.8,
    awayXG: 1.1,
    scorerIds: ['VEL-1', 'RID-1', 'RID-3'],
    motmId: 'RID-1',
    homeShots: 16,
    awayShots: 8,
    homePossession: 61,
  },
  {
    id: 'md4-KES-SOL',
    matchday: 4,
    homeId: 'KES',
    awayId: 'SOL',
    homeGoals: 3,
    awayGoals: 0,
    homeXG: 2.6,
    awayXG: 0.3,
    scorerIds: ['KES-1', 'KES-2', 'KES-1'],
    motmId: 'KES-1',
    homeShots: 18,
    awayShots: 4,
    homePossession: 64,
  },

  // ── Matchday 5 ─────────────────────────────────────────────────────────
  // Table after MD5:  1.VEL  2.KES  3.RID  4.SOL   <- KES holds 2nd, gap closing
  {
    id: 'md5-KES-RID',
    matchday: 5,
    homeId: 'KES',
    awayId: 'RID',
    homeGoals: 2,
    awayGoals: 1,
    homeXG: 1.9,
    awayXG: 1.0,
    scorerIds: ['KES-2', 'KES-1', 'RID-1'],
    motmId: 'KES-2',
    homeShots: 14,
    awayShots: 9,
    homePossession: 57,
  },
  {
    id: 'md5-VEL-SOL',
    matchday: 5,
    homeId: 'VEL',
    awayId: 'SOL',
    homeGoals: 3,
    awayGoals: 1,
    homeXG: 2.7,
    awayXG: 0.9,
    scorerIds: ['VEL-1', 'VEL-2', 'VEL-3', 'SOL-2'],
    motmId: 'VEL-1',
    homeShots: 16,
    awayShots: 7,
    homePossession: 60,
  },

  // ── Matchday 6 — TITLE DECIDER ─────────────────────────────────────────
  // Table after MD6:  1.KES  2.VEL  3.RID  4.SOL   <- KES win the league!
  {
    id: 'md6-SOL-RID',
    matchday: 6,
    homeId: 'SOL',
    awayId: 'RID',
    homeGoals: 1,
    awayGoals: 1,
    homeXG: 1.1,
    awayXG: 1.2,
    scorerIds: ['SOL-1', 'RID-2'],
    motmId: 'SOL-1',
    homeShots: 10,
    awayShots: 11,
    homePossession: 49,
  },
  {
    id: 'md6-KES-VEL',
    matchday: 6,
    homeId: 'KES',
    awayId: 'VEL',
    homeGoals: 2,
    awayGoals: 1,
    homeXG: 1.7,
    awayXG: 1.5,
    scorerIds: ['KES-1', 'KES-3', 'VEL-1'],
    motmId: 'KES-1',
    homeShots: 13,
    awayShots: 12,
    homePossession: 51,
  },
];

/** Total number of matchdays in the scripted season. */
export const TOTAL_MATCHDAYS = Math.max(...season.map((m) => m.matchday));
