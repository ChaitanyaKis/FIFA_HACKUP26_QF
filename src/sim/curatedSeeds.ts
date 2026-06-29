// Pre-vetted "highlight reel" seeds. Each was scanned (2500 seeds) and kept only
// if its race is dramatic: title decided on the FINAL day (gap 0 → on goal
// difference), >= 3 lead changes, and NO blowout (1st-4th spread <= 5, last place
// >= 5 pts). Ordered so consecutive "Reset Season" clicks cycle through DIFFERENT
// champions (RMA -> BAY -> FCB -> MUN -> ...). 737 is first (the rehearsed opener).
// Selection criteria + counts documented in docs/BUILD_LOG.md.

export const CURATED_SEEDS: number[] = [
  737, // RMA
  396, // BAY
  947, // FCB
  646, // MUN
  1597, // RMA
  741, // BAY
  2302, // FCB
  763, // MUN
  279, // RMA
  210, // BAY
  226, // FCB
  1202, // MUN
];
