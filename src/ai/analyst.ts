// Pure helpers for the AI Performance Analyst.
//
// `buildAnalystPrompt` turns a matchday's derived data into a prompt; the system
// instruction frames the model as a DATA-DRIVEN ANALYST (not a hype pundit).
// `fallbackAnalysis` produces the SAME kind of read deterministically from the
// log — referencing real deltas — so the feature never dies on stage.
//
// Both are pure: no I/O, no randomness, no clock.

import type {
  MatchResult,
  StandingsRow,
  TitleRaceState,
  MotmSpotlight,
} from '../data/types.ts';
import { computeMatchStats } from '../engine/engine.ts';
import { teamById } from '../data/lookups.ts';

/** Everything the analyst needs about a single just-played matchday. */
export interface AnalystContext {
  matchday: number;
  totalMatchdays: number;
  fixtures: MatchResult[];
  standings: StandingsRow[];
  race: TitleRaceState;
  motm: MotmSpotlight | null;
}

const tn = (id: string): string => teamById.get(id)?.name ?? id;
const tc = (id: string): string => teamById.get(id)?.shortCode ?? id;
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n));

export const ANALYST_SYSTEM =
  'You are a sharp, concise football performance analyst. Use the data given. No fabrication beyond it.';

/** Human-readable data block embedded in the prompt. */
function dataBlock(ctx: AnalystContext): string {
  const lines: string[] = [];

  lines.push(`Matchday ${ctx.matchday} of ${ctx.totalMatchdays} — final results:`);
  for (const fx of ctx.fixtures) {
    const s = computeMatchStats(fx);
    lines.push(
      `- ${tn(fx.homeId)} ${fx.homeGoals}-${fx.awayGoals} ${tn(fx.awayId)} | ` +
        `xG ${fx.homeXG.toFixed(1)}-${fx.awayXG.toFixed(1)} | ` +
        `possession ${s.possession.home}-${s.possession.away}% | ` +
        `shots ${s.shots.home}-${s.shots.away}`,
    );
  }

  lines.push('');
  lines.push(`Standings after Matchday ${ctx.matchday}:`);
  for (const r of ctx.standings) {
    lines.push(
      `${r.position}. ${tn(r.teamId)} — P${r.played} W${r.w} D${r.d} L${r.l} ` +
        `GD${signed(r.gd)} Pts${r.points}`,
    );
  }

  lines.push('');
  if (ctx.race.leaderId) {
    lines.push(
      `Title race: ${tn(ctx.race.leaderId)} lead by ${ctx.race.gapToSecond} point(s).`,
    );
  }
  if (ctx.motm) {
    lines.push(
      `Designated man of the match: ${ctx.motm.player.name} (${tc(ctx.motm.teamId)}) — ` +
        `${ctx.motm.goals} goal(s), team xG ${ctx.motm.teamXG.toFixed(1)} in a ${ctx.motm.scoreline} result.`,
    );
  }

  return lines.join('\n');
}

/** The full prompt sent to the model. */
export function buildAnalystPrompt(ctx: AnalystContext): string {
  return `${dataBlock(ctx)}

Using ONLY the data above, write:
(a) A 3-4 sentence data-driven read of this matchday. Reference the numbers: who the xG, possession and shots favoured; any over- or under-performance (goals vs xG); and justify the man of the match with the stats.
(b) On a new line beginning "Title race:", a one-line verdict on the title picture using the points/gap math.

Be precise and analytical, not hyperbolic. Do not invent any data beyond what is given.`;
}

/**
 * Deterministic analyst read built straight from the log. Templated, but every
 * clause is grounded in a real number (xG, goals-vs-xG delta, possession, the
 * points gap, matchdays remaining). Reads like analysis, never like an error.
 */
export function fallbackAnalysis(ctx: AnalystContext): string {
  const sentences: string[] = [];

  for (const fx of ctx.fixtures) {
    const s = computeMatchStats(fx);
    const draw = fx.homeGoals === fx.awayGoals;
    const xgDiff = Math.round((fx.homeXG - fx.awayXG) * 10) / 10;
    const xgLeaderId =
      xgDiff > 0 ? fx.homeId : xgDiff < 0 ? fx.awayId : null;

    if (draw) {
      sentences.push(
        `${tn(fx.homeId)} and ${tn(fx.awayId)} drew ${fx.homeGoals}-${fx.awayGoals}` +
          ` on xG of ${fx.homeXG.toFixed(1)}-${fx.awayXG.toFixed(1)}` +
          (xgLeaderId
            ? `, with ${tc(xgLeaderId)} shading the better chances`
            : `, honours even on the underlying numbers`) +
          ` (possession ${s.possession.home}-${s.possession.away}%).`,
      );
      continue;
    }

    const homeWin = fx.homeGoals > fx.awayGoals;
    const winId = homeWin ? fx.homeId : fx.awayId;
    const loseId = homeWin ? fx.awayId : fx.homeId;
    const winXG = homeWin ? fx.homeXG : fx.awayXG;
    const winGoals = Math.max(fx.homeGoals, fx.awayGoals);
    const loseGoals = Math.min(fx.homeGoals, fx.awayGoals);
    const delta = Math.round((winGoals - winXG) * 10) / 10;

    const efficiency =
      delta >= 0.6
        ? `clinical, turning ${winXG.toFixed(1)} xG into ${winGoals} goals (overperformed by ${delta.toFixed(1)})`
        : delta <= -0.6
          ? `wasteful, ${winGoals} from ${winXG.toFixed(1)} xG`
          : `in line with their ${winXG.toFixed(1)} xG`;

    const againstRun =
      xgLeaderId === loseId
        ? `, and did it against the run of play — ${tc(loseId)} actually shaded the xG ${fx.homeXG.toFixed(1)}-${fx.awayXG.toFixed(1)}`
        : '';

    sentences.push(
      `${tn(winId)} beat ${tn(loseId)} ${winGoals}-${loseGoals}, ${efficiency}${againstRun}.`,
    );
  }

  if (ctx.motm) {
    sentences.push(
      `Man of the match ${ctx.motm.player.name} (${tc(ctx.motm.teamId)}) is justified by the data: ` +
        `${ctx.motm.goals} goal(s) on ${ctx.motm.teamXG.toFixed(1)} team xG.`,
    );
  }

  const remaining = ctx.totalMatchdays - ctx.matchday;
  let titleLine: string;
  if (ctx.race.leaderId) {
    const gap = ctx.race.gapToSecond;
    const lead =
      gap === 0
        ? 'lead on tiebreakers'
        : `lead by ${gap} point${gap === 1 ? '' : 's'}`;
    const tail =
      remaining > 0
        ? ` with ${remaining} matchday${remaining === 1 ? '' : 's'} to play`
        : ' — and that is decisive';
    titleLine = `Title race: ${tn(ctx.race.leaderId)} ${lead}${tail}.`;
  } else {
    titleLine = 'Title race: too early to call.';
  }

  return `${sentences.join(' ')}\n${titleLine}`;
}
