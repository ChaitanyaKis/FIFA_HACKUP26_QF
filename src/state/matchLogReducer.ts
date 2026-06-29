// The ONLY mutable state in the app: how many matchdays have been simulated.
//
// We never store standings, stats, MOTM or form. The reducer advances a single
// integer over the match-log; every view is re-derived by the pure engine from
// `season.filter(m => m.matchday <= playedMatchdays)`. That is what guarantees
// the table and the numbers can never disagree.

import { TOTAL_MATCHDAYS } from '../data/season.ts';

export interface MatchLogState {
  /** How many matchdays have had their "final whistle" — 0..TOTAL_MATCHDAYS. */
  playedMatchdays: number;
}

export type MatchLogAction =
  | { type: 'SIMULATE_FINAL_WHISTLE' }
  | { type: 'RESET' };

export const initialState: MatchLogState = { playedMatchdays: 0 };

export function matchLogReducer(
  state: MatchLogState,
  action: MatchLogAction,
): MatchLogState {
  switch (action.type) {
    case 'SIMULATE_FINAL_WHISTLE':
      return {
        playedMatchdays: Math.min(state.playedMatchdays + 1, TOTAL_MATCHDAYS),
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}
