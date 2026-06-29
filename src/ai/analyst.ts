// Pure helpers for the AI Performance Analyst.
//
// The model is framed as a DATA-DRIVEN ANALYST of a SIMULATED season — it must
// never present a simulated stat as a real-world claim about a real player.
//   - buildAnalystPrompt: deep post-matchday tactical read.
//   - buildQAPrompt: two-way "ask the analyst", grounded in the live data block.
// Each has a deterministic, grounded fallback so the feature never dies on stage.
//
// All functions are pure: no I/O, no randomness, no clock.

import type {
  MatchResult,
  StandingsRow,
  TitleRaceState,
  MotmSpotlight,
} from '../data/types.ts';
import { computeMatchStats } from '../engine/engine.ts';
import { clubById } from '../data/lookups.ts';
import { rivalryOf } from '../data/rivalries.ts';

/** Everything the analyst needs about the live, simulated season state. */
export interface AnalystContext {
  matchday: number;
  totalMatchdays: number;
  fixtures: MatchResult[]; // the just-played matchday
  standings: StandingsRow[];
  race: TitleRaceState;
  motm: MotmSpotlight | null;
  winProb: Record<string, number>; // club -> title %
  bootLeader: { name: string; clubId: string; goals: number } | null;
  magicNumber: number | null; // for the leader (null pre-season)
  clinched: boolean;
  leaderId: string | null;
}

const tn = (id: string): string => clubById.get(id)?.name ?? id;
const tc = (id: string): string => clubById.get(id)?.shortCode ?? id;
const signed = (n: number): string => (n >= 0 ? `+${n}` : String(n));

const SIM_FRAMING =
  'This is a SIMULATED season between real clubs (a computer model, not real-world matches). Use ONLY the data given and never present these simulated stats as real-world facts about the real players or clubs.';

export const ANALYST_SYSTEM =
  'You are a sharp, data-driven football performance analyst. ' + SIM_FRAMING;

export const ANALYST_QA_SYSTEM =
  'You are a football performance analyst answering a question about a simulated season. Answer concisely (2-4 sentences) using ONLY the supplied data, citing specific numbers (win %, points, goals, xG). If the data does not contain the answer, say so plainly. ' +
  SIM_FRAMING;

/** Which club controlled tempo this fixture, from the momentum series. */
function momentumControl(fx: MatchResult): { id: string | null; label: string } {
  const homeArea = fx.momentum.reduce((s, v) => s + Math.max(0, v), 0);
  const awayArea = fx.momentum.reduce((s, v) => s + Math.max(0, -v), 0);
  if (Math.abs(homeArea - awayArea) < 3) return { id: null, label: 'even tempo' };
  const id = homeArea > awayArea ? fx.homeId : fx.awayId;
  return { id, label: `${tc(id)} controlled the tempo` };
}

/** Human-readable data block shared by the tactical read and the Q&A prompts. */
function dataBlock(ctx: AnalystContext): string {
  const lines: string[] = [];

  lines.push(`Matchday ${ctx.matchday} of ${ctx.totalMatchdays} — SIMULATED results:`);
  for (const fx of ctx.fixtures) {
    const s = computeMatchStats(fx);
    const derby = rivalryOf(fx.homeId, fx.awayId);
    const ctrl = momentumControl(fx);
    const winner =
      fx.homeGoals > fx.awayGoals ? fx.homeId : fx.awayGoals > fx.homeGoals ? fx.awayId : null;
    const againstRun = ctrl.id && winner && ctrl.id !== winner ? ' (winner went against the run of play)' : '';
    lines.push(
      `- ${tn(fx.homeId)} ${fx.homeGoals}-${fx.awayGoals} ${tn(fx.awayId)}` +
        (derby ? ` [${derby}]` : '') +
        ` | xG ${fx.homeXG.toFixed(1)}-${fx.awayXG.toFixed(1)}` +
        ` | SOT ${fx.sot.home}-${fx.sot.away} | shots ${s.shots.home}-${s.shots.away}` +
        ` | poss ${s.possession.home}-${s.possession.away}%` +
        ` | momentum: ${ctrl.label}${againstRun}`,
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
  const odds = Object.keys(ctx.winProb)
    .sort((a, b) => ctx.winProb[b] - ctx.winProb[a])
    .map((id) => `${tc(id)} ${ctx.winProb[id]}%`)
    .join(', ');
  lines.push(`Title win probability (Monte Carlo): ${odds}`);
  if (ctx.leaderId) {
    if (ctx.clinched) lines.push(`${tn(ctx.leaderId)} have mathematically clinched the title.`);
    else if (ctx.magicNumber != null)
      lines.push(`Magic number for ${tn(ctx.leaderId)}: ${ctx.magicNumber}.`);
  }
  if (ctx.bootLeader) {
    lines.push(
      `Golden Boot leader: ${ctx.bootLeader.name} (${tc(ctx.bootLeader.clubId)}) — ${ctx.bootLeader.goals} goals.`,
    );
  }
  if (ctx.motm) {
    lines.push(
      `Designated man of the match: ${ctx.motm.player.name} (${tc(ctx.motm.teamId)}), ${ctx.motm.goals} goal(s).`,
    );
  }
  return lines.join('\n');
}

/** Deep post-matchday tactical read. */
export function buildAnalystPrompt(ctx: AnalystContext): string {
  return `${SIM_FRAMING}

${dataBlock(ctx)}

Write a sharp tactical read of this matchday (4-6 sentences):
- Who DESERVED the result on xG and momentum, and any over-/under-performance vs xG.
- A game-state reading of the key fixture (control of tempo, swing, finishing).
- Justify the man of the match with the stats.
Then, on a new line beginning "Title race:", a one-line verdict that CITES the win probability (e.g. "Real Madrid's title chance is now 78%").
Be precise and analytical, not hyperbolic. Do not invent data beyond what is given.`;
}

/** Two-way: answer a free-form question grounded in the live data block. */
export function buildQAPrompt(ctx: AnalystContext, question: string): string {
  return `${SIM_FRAMING}

LIVE DATA:
${dataBlock(ctx)}

The user asks: "${question}"

Answer in 2-4 sentences using ONLY the data above, citing specific numbers (win %, points, goals, xG, momentum). If the data does not contain the answer, say so.`;
}

// ── Deterministic fallbacks (grounded, never an error) ──────────────────────

function leaderLine(ctx: AnalystContext): string {
  const ranked = Object.keys(ctx.winProb).sort((a, b) => ctx.winProb[b] - ctx.winProb[a]);
  const top = ranked[0];
  const second = ranked[1];
  const magic =
    ctx.clinched && ctx.leaderId
      ? `${tn(ctx.leaderId)} have clinched it`
      : ctx.magicNumber != null && ctx.leaderId
        ? `${tn(ctx.leaderId)}'s magic number is ${ctx.magicNumber}`
        : 'the title is still open';
  return `${tn(top)} lead the title race on a ${ctx.winProb[top]}% modelled chance, with ${tn(second)} next on ${ctx.winProb[second]}% — ${magic}.`;
}

/** Deterministic tactical read (grounded in real deltas), used without a key. */
export function fallbackAnalysis(ctx: AnalystContext): string {
  const sentences: string[] = [];

  for (const fx of ctx.fixtures) {
    const draw = fx.homeGoals === fx.awayGoals;
    const ctrl = momentumControl(fx);
    if (draw) {
      sentences.push(
        `${tn(fx.homeId)} and ${tn(fx.awayId)} drew ${fx.homeGoals}-${fx.awayGoals} on xG of ${fx.homeXG.toFixed(1)}-${fx.awayXG.toFixed(1)} (${ctrl.label}).`,
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
        ? `clinical (${winGoals} goals from ${winXG.toFixed(1)} xG)`
        : delta <= -0.6
          ? `wasteful (${winGoals} from ${winXG.toFixed(1)} xG)`
          : `in line with their ${winXG.toFixed(1)} xG`;
    const run = ctrl.id === loseId ? `, though ${tc(loseId)} ${ctrl.label.split(' ').slice(1).join(' ')} — against the run of play` : `; ${ctrl.label}`;
    sentences.push(`${tn(winId)} beat ${tn(loseId)} ${winGoals}-${loseGoals}, ${efficiency}${run}.`);
  }

  if (ctx.motm) {
    sentences.push(
      `Man of the match ${ctx.motm.player.name} (${tc(ctx.motm.teamId)}) — ${ctx.motm.goals} goal(s) on ${ctx.motm.teamXG.toFixed(1)} team xG.`,
    );
  }
  if (ctx.bootLeader) {
    sentences.push(
      `${ctx.bootLeader.name} leads the Golden Boot on ${ctx.bootLeader.goals}.`,
    );
  }
  return `${sentences.join(' ')}\nTitle race: ${leaderLine(ctx)}`;
}

/** Find a club referenced in free text (name, code or nickname). */
function clubInQuestion(q: string): string | null {
  const lower = q.toLowerCase();
  const nick: Record<string, string[]> = {
    RMA: ['madrid', 'real', 'rma', 'los blancos'],
    FCB: ['barcelona', 'barça', 'barca', 'fcb', 'blaugrana'],
    MUN: ['united', 'man u', 'man utd', 'mun', 'red devils'],
    BAY: ['bayern', 'munich', 'bay', 'die roten'],
  };
  for (const [id, words] of Object.entries(nick)) {
    if (words.some((w) => lower.includes(w))) return id;
  }
  return null;
}

/** Deterministic, grounded answer to a typed question (no key / error / 429). */
export function fallbackAnswer(ctx: AnalystContext, question: string): string {
  const q = question.toLowerCase();
  const club = clubInQuestion(question);
  const rowOf = (id: string) => ctx.standings.find((r) => r.teamId === id);

  // Title / "can X win the league" / chances.
  if (/title|league|champion|chance|win it|finish top/.test(q)) {
    if (club) {
      const pct = ctx.winProb[club] ?? 0;
      const row = rowOf(club);
      const verdict =
        pct === 0
          ? `${tn(club)} can no longer win the title`
          : pct >= 60
            ? `${tn(club)} are firm favourites`
            : pct > 0
              ? `${tn(club)} are still in it`
              : `${tn(club)} are out of contention`;
      return `${verdict}: a ${pct}% modelled title chance, currently ${row?.position}${ordinal(row?.position)} on ${row?.points} points. ${leaderLine(ctx)}`;
    }
    return `On the data, ${leaderLine(ctx)}`;
  }

  // Top scorer / Golden Boot.
  if (/top scorer|golden boot|scorer|most goals|boot/.test(q)) {
    return ctx.bootLeader
      ? `${ctx.bootLeader.name} (${tc(ctx.bootLeader.clubId)}) leads the Golden Boot with ${ctx.bootLeader.goals} goals.`
      : 'No goals have been scored yet this season.';
  }

  // Why did X lose/win (despite possession etc.) — over/underperformance read.
  if (club && /(why|despite|lose|lost|won|win|possession|deserve)/.test(q)) {
    const fx = ctx.fixtures.find((f) => f.homeId === club || f.awayId === club);
    if (fx) {
      const isHome = fx.homeId === club;
      const gf = isHome ? fx.homeGoals : fx.awayGoals;
      const ga = isHome ? fx.awayGoals : fx.homeGoals;
      const xgf = isHome ? fx.homeXG : fx.awayXG;
      const xga = isHome ? fx.awayXG : fx.homeXG;
      const poss = isHome ? fx.homePossession : 100 - fx.homePossession;
      const ctrl = momentumControl(fx);
      const res = gf > ga ? 'won' : gf < ga ? 'lost' : 'drew';
      return `${tn(club)} ${res} ${gf}-${ga} with ${poss}% possession but ${xgf.toFixed(1)} xG to ${xga.toFixed(1)} — ${ctrl.label}. ${gf < xgf - 0.5 ? 'They were wasteful in front of goal.' : gf > xgf + 0.5 ? 'They were clinical relative to the chances.' : 'The result was roughly in line with the xG.'}`;
    }
    return `${tn(club)} did not feature in the latest matchday.`;
  }

  // Form.
  if (/form|in form|momentum|hot/.test(q)) {
    const target = club ?? ctx.leaderId;
    if (target) {
      const row = rowOf(target);
      return `${tn(target)} sit ${row?.position}${ordinal(row?.position)} on ${row?.points} points; recent form ${row?.form.slice(-5).join('-') || 'n/a'}. ${ctx.bootLeader ? `${ctx.bootLeader.name} is the form striker on ${ctx.bootLeader.goals} goals.` : ''}`;
    }
  }

  // Default: a grounded state summary.
  return `Through Matchday ${ctx.matchday}: ${leaderLine(ctx)}${ctx.bootLeader ? ` ${ctx.bootLeader.name} leads the scoring charts on ${ctx.bootLeader.goals}.` : ''}`;
}

function ordinal(n: number | undefined): string {
  if (!n) return '';
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}
