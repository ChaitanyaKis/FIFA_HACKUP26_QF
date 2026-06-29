// Pure reference lookups over the static club/player tables. UI reads these;
// they derive nothing from the match-log, so they live with the data layer.

import { clubs, players } from './clubs.ts';
import type { Club, Player } from './types.ts';

export const clubById: Map<string, Club> = new Map(clubs.map((c) => [c.id, c]));
export const playerById: Map<string, Player> = new Map(
  players.map((p) => [p.id, p]),
);

export function clubName(id: string): string {
  return clubById.get(id)?.name ?? id;
}
export function clubCode(id: string): string {
  return clubById.get(id)?.shortCode ?? id;
}
export function clubPrimary(id: string): string {
  return clubById.get(id)?.primaryColor ?? '#8892a6';
}
export function clubSecondary(id: string): string {
  return clubById.get(id)?.secondaryColor ?? '#8892a6';
}

/** Resolve a club crest to a BASE_URL-prefixed public path (null if none). */
export function crestSrc(crest: string | undefined): string | null {
  return crest ? import.meta.env.BASE_URL + crest : null;
}
