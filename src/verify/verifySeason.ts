// Runnable proof that the scripted season produces the intended underdog climb.
//
// Run with:  npm run verify
//
// It advances the full season matchday-by-matchday, prints the derived table
// after each round, and asserts the underdog (Kestrel City) starts 4th and
// finishes 1st. This is the deterministic check that the data + engine agree.

import {
  computeStandings,
  pickMOTM,
  titleRaceState,
} from '../engine/engine.ts';
import {
  season,
  teams,
  players,
  UNDERDOG_ID,
  TOTAL_MATCHDAYS,
} from '../data/season.ts';
import type { StandingsRow } from '../data/types.ts';

const teamById = new Map(teams.map((t) => [t.id, t]));
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const padL = (s: string | number, n: number) => String(s).padStart(n);

function positionOf(rows: StandingsRow[], teamId: string): number {
  return rows.find((r) => r.teamId === teamId)?.position ?? -1;
}

function printTable(matchday: number, rows: StandingsRow[]): void {
  console.log(`\n  ── After Matchday ${matchday} ` + '─'.repeat(34));
  console.log(
    '  ' +
      pad('#', 3) +
      pad('Team', 20) +
      padL('P', 3) +
      padL('W', 3) +
      padL('D', 3) +
      padL('L', 3) +
      padL('GF', 4) +
      padL('GA', 4) +
      padL('GD', 4) +
      padL('Pts', 5) +
      '   Form',
  );
  for (const row of rows) {
    const team = teamById.get(row.teamId);
    const name = team ? team.name : row.teamId;
    const tag = row.teamId === UNDERDOG_ID ? '  <- UNDERDOG' : '';
    const gd = (row.gd > 0 ? '+' : '') + row.gd;
    console.log(
      '  ' +
        pad(row.position, 3) +
        pad(name, 20) +
        padL(row.played, 3) +
        padL(row.w, 3) +
        padL(row.d, 3) +
        padL(row.l, 3) +
        padL(row.gf, 4) +
        padL(row.ga, 4) +
        padL(gd, 4) +
        padL(row.points, 5) +
        '   ' +
        row.form.join(' ') +
        tag,
    );
  }
}

console.log('========================================================');
console.log(' SEASON VERIFICATION — underdog climb proof');
console.log('========================================================');

const climb: number[] = [];

for (let md = 1; md <= TOTAL_MATCHDAYS; md++) {
  const playedSoFar = season.filter((m) => m.matchday <= md);
  const standings = computeStandings(playedSoFar, teams);
  printTable(md, standings);
  climb.push(positionOf(standings, UNDERDOG_ID));
}

// Final-season extras: title race + man-of-the-match log.
const finalStandings = computeStandings(season, teams);
const race = titleRaceState(finalStandings);
const leaderName = race.leaderId
  ? (teamById.get(race.leaderId)?.name ?? race.leaderId)
  : '(none)';

console.log('\n  ── Title race ' + '─'.repeat(40));
console.log(
  `  Leader: ${leaderName}  |  clear of 2nd by ${race.gapToSecond} pt(s)`,
);

console.log('\n  ── Man of the Match per fixture ' + '─'.repeat(22));
for (const match of season) {
  const motm = pickMOTM(match, players);
  const home = teamById.get(match.homeId)?.shortCode ?? match.homeId;
  const away = teamById.get(match.awayId)?.shortCode ?? match.awayId;
  const score = `${match.homeGoals}-${match.awayGoals}`;
  console.log(
    `  MD${match.matchday}  ${pad(`${home} ${score} ${away}`, 14)}  MOTM: ${
      motm ? motm.name : '(unresolved)'
    }`,
  );
}

// ── Assertions ──────────────────────────────────────────────────────────
const underdogName = teamById.get(UNDERDOG_ID)?.name ?? UNDERDOG_ID;
const startPos = climb[0];
const endPos = climb[climb.length - 1];

console.log('\n========================================================');
console.log(` ${underdogName} position by matchday: ${climb.join(' -> ')}`);

const failures: string[] = [];
if (startPos !== 4) {
  failures.push(`expected underdog to START 4th, but was ${startPos}`);
}
if (endPos !== 1) {
  failures.push(`expected underdog to FINISH 1st, but was ${endPos}`);
}
if (race.leaderId !== UNDERDOG_ID) {
  failures.push(`expected title-race leader to be the underdog`);
}
// Sanity: every team played the same number of games (full double round-robin).
const games = finalStandings.map((r) => r.played);
if (new Set(games).size !== 1) {
  failures.push(`teams played uneven game counts: ${games.join(',')}`);
}

if (failures.length > 0) {
  console.log(' RESULT: ❌ FAIL');
  for (const f of failures) console.log('   - ' + f);
  console.log('========================================================');
  throw new Error('Season verification FAILED');
}

console.log(
  ` RESULT: ✅ PASS — ${underdogName} climbed from 4th to 1st as scripted.`,
);
console.log('========================================================');
