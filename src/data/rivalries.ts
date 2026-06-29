// Rivalry / marquee-fixture config. Data-driven and extensible: add a pair
// (key = the two club ids sorted, joined by "|") → its name. If the configured
// clubs aren't among the active four, nothing fires — no derby, no error.

export const RIVALRIES: Record<string, string> = {
  'FCB|RMA': 'El Clásico',
  // e.g. 'CITY|MUN': 'Manchester Derby' — only fires if both clubs are loaded
};

/** Name of the rivalry for a fixture, or null if the pair isn't a configured rivalry. */
export function rivalryOf(a: string, b: string): string | null {
  return RIVALRIES[[a, b].sort().join('|')] ?? null;
}
