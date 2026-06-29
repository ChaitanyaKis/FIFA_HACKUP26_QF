// App state. The season SEED is now MUTABLE state — the whole season is derived
// from it by simulateSeason. We also track how far the season is revealed
// (playedMatchdays, driven by the Final Whistle / scrubber) and any What-If
// edits (per-fixture scoreline + chosen scorers) applied on top of the sim.

import { CURATED_SEEDS } from '../sim/curatedSeeds.ts';

/** A What-If override for one fixture. */
export interface WhatIfEdit {
  homeGoals: number;
  awayGoals: number;
  homeScorers: string[]; // chosen scorer per home goal ('' = auto)
  awayScorers: string[];
}

export interface AppState {
  seed: number;
  curatedIndex: number; // index into CURATED_SEEDS, or -1 for a random ("surprise") seed
  playedMatchdays: number;
  edits: Record<string, WhatIfEdit>; // fixtureId -> edit
}

export type AppAction =
  | { type: 'SET_PLAYED'; matchdays: number }
  | { type: 'NEXT_CURATED' } // Reset Season → next curated seed
  | { type: 'RANDOM_SEED'; seed: number } // Surprise me
  | { type: 'APPLY_EDIT'; fixtureId: string; edit: WhatIfEdit }
  | { type: 'REVERT_ONE'; fixtureId: string }
  | { type: 'REVERT_EDITS' };

export const initialState: AppState = {
  seed: CURATED_SEEDS[0], // 737 — the rehearsed opener
  curatedIndex: 0,
  playedMatchdays: 0,
  edits: {},
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PLAYED':
      return { ...state, playedMatchdays: Math.max(0, action.matchdays) };

    case 'NEXT_CURATED': {
      const nextIndex =
        state.curatedIndex < 0 ? 0 : (state.curatedIndex + 1) % CURATED_SEEDS.length;
      return {
        seed: CURATED_SEEDS[nextIndex],
        curatedIndex: nextIndex,
        playedMatchdays: 0,
        edits: {},
      };
    }

    case 'RANDOM_SEED':
      return { seed: action.seed, curatedIndex: -1, playedMatchdays: 0, edits: {} };

    case 'APPLY_EDIT':
      return {
        ...state,
        edits: { ...state.edits, [action.fixtureId]: action.edit },
      };

    case 'REVERT_ONE': {
      const next = { ...state.edits };
      delete next[action.fixtureId];
      return { ...state, edits: next };
    }

    case 'REVERT_EDITS':
      return { ...state, edits: {} };

    default:
      return state;
  }
}
