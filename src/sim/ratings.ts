// Club strength ratings that drive the simulation. Values are kept deliberately
// CLOSE so the league is competitive and the title race is emergent (not
// authored). `attack` ≈ goals a club generates vs a reference defence; `defense`
// ≈ defensive solidity (higher suppresses the opponent more).

export interface ClubRating {
  attack: number;
  defense: number;
}

export const RATINGS: Record<string, ClubRating> = {
  RMA: { attack: 1.95, defense: 1.38 },
  FCB: { attack: 1.98, defense: 1.34 },
  MUN: { attack: 1.78, defense: 1.3 },
  BAY: { attack: 1.92, defense: 1.4 },
};

/** Reference defence the `attack` numbers are calibrated against. */
export const BASE_DEFENSE = 1.2;

/** Multiplier applied to the home side's expected goals. */
export const HOME_ADVANTAGE = 1.12;

/** Fallback rating for any club id missing from RATINGS. */
export const DEFAULT_RATING: ClubRating = { attack: 1.8, defense: 1.3 };
