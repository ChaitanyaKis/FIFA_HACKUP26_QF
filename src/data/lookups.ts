// Pure reference lookups over the static team/player tables. UI reads these;
// they derive nothing from the match-log, so they live with the data layer.

import { teams, players } from './season.ts';
import type { Team, Player } from './types.ts';

export const teamById: Map<string, Team> = new Map(teams.map((t) => [t.id, t]));
export const playerById: Map<string, Player> = new Map(
  players.map((p) => [p.id, p]),
);

export function teamName(id: string): string {
  return teamById.get(id)?.name ?? id;
}
export function teamCode(id: string): string {
  return teamById.get(id)?.shortCode ?? id;
}
export function teamColor(id: string): string {
  return teamById.get(id)?.color ?? '#8892a6';
}
