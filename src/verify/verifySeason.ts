// Runnable proof of the SIMULATED, enriched season.
//
//  - STEP 0: re-simulates seeds 738/739/740 to show the season is seed-driven.
//  - For SEED 737: prints the table + goal events (minute/scorer/assist) per
//    matchday and one fixture's momentum summary.
//  - Asserts every invariant, incl. goal totals + final standings BYTE-IDENTICAL
//    to the pre-enrichment 737 result.
//
// Run with:  npm run verify

import { computeStandings, titleRaceState, pickMatchdayMOTM } from '../engine/engine.ts';
import {
  deriveGoldenBoot,
  awayTable,
  derivePositionWorm,
  deriveTitleRace,
  deriveWinProbabilityByMatchday,
  monteCarloTitleOdds,
  deriveAnalystRecord,
  predictMatchday,
} from '../engine/derive.ts';
import {
  ANALYST_SYSTEM,
  ANALYST_QA_SYSTEM,
  buildAnalystPrompt,
  buildQAPrompt,
  fallbackAnalysis,
  fallbackAnswer,
} from '../ai/analyst.ts';
import type { AnalystContext } from '../ai/analyst.ts';
import { simulateSeason, reEnrichFixture, SEED } from '../sim/engine.ts';
import { CURATED_SEEDS } from '../sim/curatedSeeds.ts';
import { initialState } from '../state/matchLogReducer.ts';
import { clubs, players, SQUAD_SNAPSHOT_DATE } from '../data/clubs.ts';
import { season, TOTAL_MATCHDAYS } from '../data/season.ts';
import type { MatchResult } from '../data/types.ts';

const clubById = new Map(clubs.map((c) => [c.id, c]));
const playerById = new Map(players.map((p) => [p.id, p]));
const clubIds = clubs.map((c) => c.id);
const code = (id: string) => clubById.get(id)?.shortCode ?? id;
const pname = (id: string) => playerById.get(id)?.name ?? id;

// Pre-enrichment SEED 737 goal totals — must stay byte-identical.
const EXPECTED_TOTALS: Record<string, [number, number]> = {
  'md1-RMA-FCB': [2, 1], 'md1-MUN-BAY': [4, 1],
  'md2-RMA-MUN': [3, 1], 'md2-BAY-FCB': [0, 2],
  'md3-RMA-BAY': [1, 2], 'md3-FCB-MUN': [0, 2],
  'md4-FCB-RMA': [1, 1], 'md4-BAY-MUN': [4, 1],
  'md5-MUN-RMA': [3, 2], 'md5-FCB-BAY': [1, 4],
  'md6-BAY-RMA': [0, 2], 'md6-MUN-FCB': [2, 2],
};

const failures: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) failures.push(msg); };

console.log('========================================================');
console.log(' STEP 0 — is it a sim? (different seeds → different seasons)');
console.log('========================================================');
for (const seed of [738, 739, 740]) {
  const s = simulateSeason(seed, clubIds, players);
  const t = computeStandings(s, clubs);
  const f = s.filter((m) => m.matchday === 1);
  console.log(
    `  seed ${seed}: champ ${code(t[0].teamId)} (${t[0].points}pts) | ` +
      `final ${t.map((r) => `${code(r.teamId)}:${r.points}`).join(' ')} | ` +
      `MD1 ${code(f[0].homeId)} ${f[0].homeGoals}-${f[0].awayGoals} ${code(f[0].awayId)}, ` +
      `${code(f[1].homeId)} ${f[1].homeGoals}-${f[1].awayGoals} ${code(f[1].awayId)}`,
  );
}

console.log('\n========================================================');
console.log(` SEED ${SEED} — enriched season (snapshot ${SQUAD_SNAPSHOT_DATE})`);
console.log('========================================================');

for (let md = 1; md <= TOTAL_MATCHDAYS; md++) {
  const fixtures = season.filter((m) => m.matchday === md);
  const standings = computeStandings(
    season.filter((m) => m.matchday <= md),
    clubs,
  );
  console.log(
    `\n  -- After MD${md}: ` +
      standings.map((r) => `${code(r.teamId)} ${r.points}(${r.gd >= 0 ? '+' : ''}${r.gd})`).join('  '),
  );
  for (const fx of fixtures) {
    console.log(`     ${code(fx.homeId)} ${fx.homeGoals}-${fx.awayGoals} ${code(fx.awayId)}  (xG ${fx.homeXG}-${fx.awayXG}, SOT ${fx.sot.home}-${fx.sot.away})`);
    for (const g of fx.goalEvents) {
      const a = g.assistId ? ` (assist ${pname(g.assistId)})` : '';
      console.log(`        ${g.minute}'  ${pname(g.scorerId)} [${code(g.clubId)}]${a}`);
    }
    const motm = fx.ratings.find((r) => r.playerId === fx.motmId);
    if (fx.cards.length) {
      console.log(`        cards: ${fx.cards.map((c) => `${pname(c.playerId)} ${c.type[0].toUpperCase()}${c.minute}'`).join(', ')}`);
    }
    if (fx.suspended.length) {
      console.log(`        suspended: ${fx.suspended.map(pname).join(', ')}`);
    }
    console.log(`        MOTM ${pname(fx.motmId)} (rating ${motm?.rating})`);
  }
}

// Momentum summary for one fixture.
const sample = season.find((m) => m.id === 'md1-MUN-BAY')!;
const hArea = sample.momentum.reduce((s, v) => s + Math.max(0, v), 0);
const aArea = sample.momentum.reduce((s, v) => s + Math.max(0, -v), 0);
console.log('\n  -- Momentum summary: md1-MUN-BAY ' + '-'.repeat(20));
console.log(`     xG ${sample.homeXG} (MUN) vs ${sample.awayXG} (BAY)`);
console.log(`     home-area ${hArea.toFixed(1)} vs away-area ${aArea.toFixed(1)} → larger area on the higher-xG side: ${hArea > aArea === sample.homeXG > sample.awayXG ? 'YES' : 'NO'}`);

// ── Analytics (engine/derive.ts) ───────────────────────────────────────────
console.log('\n========================================================');
console.log(' ANALYTICS — derived purely from the results array');
console.log('========================================================');

console.log('\n  Golden Boot (top 3):');
deriveGoldenBoot(season).slice(0, 3).forEach((s, i) =>
  console.log(`   ${i + 1}. ${pname(s.playerId)} [${code(s.clubId)}] — ${s.goals} goals, ${s.matches} apps, ${s.assists} assists`),
);

console.log('\n  Away table:');
for (const r of awayTable(season, clubs)) {
  console.log(`   ${r.position}. ${code(r.teamId)}  P${r.played} ${r.w}-${r.d}-${r.l}  GD ${r.gd >= 0 ? '+' : ''}${r.gd}  ${r.points}pts`);
}

console.log('\n  Position worm (after MD1..MD' + TOTAL_MATCHDAYS + '):');
const worm = derivePositionWorm(season, clubs);
for (const w of worm) console.log(`   ${code(w.clubId)}: ${w.positions.join(' -> ')}`);

const race737 = deriveTitleRace(season, clubs);
console.log(`\n  Title clinch: MD${race737.clinchedMatchday} -> champion ${clubById.get(race737.championId ?? '')?.name}`);
for (const c of race737.perMatchday) {
  console.log(`   MD${c.matchday}: leader ${code(c.leaderId)}, gamesLeft ${c.gamesLeft}, magic ${c.magicNumber}, clinched ${c.clinched}`);
}

const wp = deriveWinProbabilityByMatchday(season, clubs, { runs: 4000 });
const fmtOdds = (o: Record<string, number>) => clubIds.map((id) => `${code(id)} ${o[id]}%`).join('  ');
console.log('\n  Win probability (Monte Carlo, 4000 runs):');
console.log(`   after MD1: ${fmtOdds(wp[0].odds)}`);
console.log(`   after MD${TOTAL_MATCHDAYS}: ${fmtOdds(wp[wp.length - 1].odds)}`);

// ── Invariants ────────────────────────────────────────────────────────────
const finalStandings = computeStandings(season, clubs);

// Worm equals the real table at every matchday.
for (let md = 1; md <= TOTAL_MATCHDAYS; md++) {
  const posById = new Map(
    computeStandings(season.filter((m) => m.matchday <= md), clubs).map((r) => [r.teamId, r.position]),
  );
  for (const w of worm) {
    check(w.positions[md - 1] === posById.get(w.clubId), `worm ${w.clubId} MD${md} != real position`);
  }
}
// Title clinches on the final day only; champion RMA.
check(race737.clinchedMatchday === TOTAL_MATCHDAYS, `clinch MD ${race737.clinchedMatchday} != final day`);
check(race737.championId === 'RMA', `champion ${race737.championId} != RMA`);
check(race737.perMatchday.slice(0, -1).every((c) => !c.clinched), 'title clinched before the final day');
// Win-prob converges to 100/0 at season end and is a sane distribution at MD1.
const finalOdds = wp[wp.length - 1].odds;
check(finalOdds['RMA'] === 100 && ['FCB', 'MUN', 'BAY'].every((id) => finalOdds[id] === 0), 'win-prob did not converge to 100/0');
const md1Sum = clubIds.reduce((s, id) => s + wp[0].odds[id], 0);
check(md1Sum >= 98 && md1Sum <= 102, `MD1 win-prob sums to ${md1Sum} (expected ~100)`);

// Byte-identical goal totals.
for (const m of season) {
  const exp = EXPECTED_TOTALS[m.id];
  check(!!exp && m.homeGoals === exp[0] && m.awayGoals === exp[1],
    `${m.id}: totals ${m.homeGoals}-${m.awayGoals} != expected ${exp?.join('-')}`);
}
// Final standings byte-identical (order + points).
const order = finalStandings.map((r) => r.teamId).join(',');
check(order === 'RMA,MUN,BAY,FCB', `final order ${order} != RMA,MUN,BAY,FCB`);
check(finalStandings[0].points === 10 && finalStandings[1].points === 10,
  `RMA/MUN not level on 10 (${finalStandings[0].points}/${finalStandings[1].points})`);

// ΣGF==ΣGA, and one game per club per matchday.
check(finalStandings.reduce((s, r) => s + r.gf, 0) === finalStandings.reduce((s, r) => s + r.ga, 0), 'ΣGF != ΣGA');
for (let md = 1; md <= TOTAL_MATCHDAYS; md++) {
  const apps = season.filter((m) => m.matchday === md).flatMap((m) => [m.homeId, m.awayId]);
  check(apps.length === clubIds.length && new Set(apps).size === clubIds.length, `MD${md}: not one game per club`);
}

// Per-fixture detail invariants.
// Per-fixture invariants, reusable across 737, random seeds and What-If edits.
function fixtureInvariantErrors(m: MatchResult): string[] {
  const errs: string[] = [];
  const fail = (cond: boolean, msg: string) => {
    if (!cond) errs.push(`${m.id}: ${msg}`);
  };
  const sides = new Set([m.homeId, m.awayId]);
  const suspended = new Set(m.suspended);
  fail(m.homeGoals <= m.sot.home && m.sot.home <= m.homeShots, 'home goals≤sot≤shots');
  fail(m.awayGoals <= m.sot.away && m.sot.away <= m.awayShots, 'away goals≤sot≤shots');
  const heHome = m.goalEvents.filter((g) => g.clubId === m.homeId).length;
  const heAway = m.goalEvents.filter((g) => g.clubId === m.awayId).length;
  fail(heHome === m.homeGoals && heAway === m.awayGoals, 'goal-event count != goals');
  for (const g of m.goalEvents) {
    const scorer = playerById.get(g.scorerId);
    fail(!!scorer && scorer.clubId === g.clubId && sides.has(g.clubId), 'scorer not in scoring club');
    fail(scorer?.position !== 'GK', 'GK credited with a goal');
    fail(!suspended.has(g.scorerId), 'suspended player scored');
    if (g.assistId) {
      fail(g.assistId !== g.scorerId, 'assist == scorer');
      const a = playerById.get(g.assistId);
      fail(!!a && a.clubId === g.clubId, 'assist not same club');
      fail(!suspended.has(g.assistId), 'suspended player assisted');
    }
  }
  for (const c of m.cards) {
    const p = playerById.get(c.playerId);
    fail(!!p && sides.has(p.clubId), 'card player not in fixture');
    fail(!suspended.has(c.playerId), 'suspended player booked');
  }
  for (const r of m.ratings) fail(r.rating >= 4 && r.rating <= 10, `rating ${r.rating} out of range`);
  const top = Math.max(...m.ratings.map((r) => r.rating));
  fail(m.ratings.find((r) => r.playerId === m.motmId)?.rating === top, 'MOTM != top rating');
  if (m.homeXG !== m.awayXG) {
    const sum = m.momentum.reduce((s, v) => s + v, 0);
    fail(sum > 0 === m.homeXG > m.awayXG, 'momentum integral sign != xG edge');
  }
  return errs;
}
for (const m of season as MatchResult[]) for (const e of fixtureInvariantErrors(m)) failures.push(e);

// Reproducibility.
check(JSON.stringify(simulateSeason(SEED, clubIds, players)) === JSON.stringify(season),
  'season not reproducible from SEED');

// ── G3: interactive-layer robustness ────────────────────────────────────────
console.log('\n========================================================');
console.log(' G3 — interactive layer (mutable seed, What-If, curated)');
console.log('========================================================');

// Landing season is 737.
check(initialState.seed === 737, `landing seed ${initialState.seed} != 737`);
check(CURATED_SEEDS[0] === 737, 'CURATED_SEEDS[0] != 737');

// 3 consecutive curated resets → 3 different champions.
const curatedChamps = CURATED_SEEDS.slice(0, 3).map(
  (s) => computeStandings(simulateSeason(s, clubIds, players), clubs)[0].teamId,
);
console.log(`  Curated resets 1-3 → champions: ${curatedChamps.map(code).join(' , ')}`);
check(new Set(curatedChamps).size === 3, `first 3 curated champions not distinct: ${curatedChamps}`);

// Invariants hold for 20 arbitrary (uncurated) random seeds.
let randomFixtures = 0;
for (let i = 0; i < 20; i++) {
  const rs = 50000 + i * 7919; // arbitrary, uncurated
  const rseason = simulateSeason(rs, clubIds, players);
  const rtable = computeStandings(rseason, clubs);
  check(rtable.reduce((s, r) => s + r.gf, 0) === rtable.reduce((s, r) => s + r.ga, 0), `seed ${rs}: ΣGF != ΣGA`);
  for (const md of [1, 2, 3, 4, 5, 6]) {
    const apps = rseason.filter((m) => m.matchday === md).flatMap((m) => [m.homeId, m.awayId]);
    check(new Set(apps).size === clubIds.length, `seed ${rs} MD${md}: not one game/club`);
  }
  for (const m of rseason) {
    randomFixtures++;
    for (const e of fixtureInvariantErrors(m)) failures.push(`seed ${rs} ${e}`);
  }
}
console.log(`  20 random seeds simulated (${randomFixtures} fixtures) — invariants checked`);

// What-If edit cascades AND keeps invariants: flip the final-day RMA win.
const champBefore = computeStandings(season, clubs)[0].teamId;
const target = season.find((m) => m.id === 'md6-BAY-RMA')!;
const edited = reEnrichFixture(target, 2, 0, players); // BAY 2-0 RMA (RMA lose)
const editedSeason = season.map((m) => (m.id === edited.id ? edited : m));
const champAfter = computeStandings(editedSeason, clubs)[0].teamId;
console.log(`  What-If md6-BAY-RMA → BAY 2-0 RMA: champion ${code(champBefore)} → ${code(champAfter)}`);
check(champBefore === 'RMA' && champAfter !== 'RMA', `edit did not change champion (${champBefore}->${champAfter})`);
const editErrs = fixtureInvariantErrors(edited);
for (const e of editErrs) failures.push(`edit ${e}`);
check(edited.homeGoals === 2 && edited.awayGoals === 0, 'edit goals not applied');
check(editErrs.length === 0, 'edited fixture broke invariants');

// ── Analyst: predictions, accuracy, grounded Q&A, sim framing ───────────────
console.log('\n========================================================');
console.log(' ANALYST — predictions, track record, grounded Q&A');
console.log('========================================================');

const rec = deriveAnalystRecord(season, TOTAL_MATCHDAYS);
console.log(`  Track record (737): ${rec.correct}/${rec.total} correct`);
check(rec.total === season.length, `record total ${rec.total} != fixtures ${season.length}`);
check(rec.correct >= 0 && rec.correct <= rec.total, 'record correct out of range');

const md1Pred = predictMatchday(season, 1);
console.log(
  `  Analyst's MD1 call: ` +
    md1Pred.map((p) => `${code(p.homeId)} ${p.predHome}-${p.predAway} ${code(p.awayId)}`).join(' · '),
);
check(md1Pred.length === 2, 'MD1 prediction count != 2');

// Build a mid-season analyst context (MD4) to exercise the read + Q&A.
const md = 4;
const slice = season.filter((m) => m.matchday <= md);
const standings4 = computeStandings(slice, clubs);
const winProb4 = monteCarloTitleOdds(slice, season.filter((m) => m.matchday > md), clubs);
const boot4 = deriveGoldenBoot(slice)[0];
const clinch4 = deriveTitleRace(season, clubs).perMatchday[md - 1];
const ctx: AnalystContext = {
  matchday: md,
  totalMatchdays: TOTAL_MATCHDAYS,
  fixtures: season.filter((m) => m.matchday === md),
  standings: standings4,
  race: titleRaceState(standings4),
  motm: pickMatchdayMOTM(season, players, md),
  winProb: winProb4,
  bootLeader: boot4
    ? { name: pname(boot4.playerId), clubId: boot4.clubId, goals: boot4.goals }
    : null,
  magicNumber: clinch4.magicNumber,
  clinched: clinch4.clinched,
  leaderId: standings4[0].teamId,
};

// Sim framing must appear everywhere.
check(/simulat/i.test(ANALYST_SYSTEM) && /simulat/i.test(ANALYST_QA_SYSTEM), 'system prompts lack sim framing');
check(/SIMULATED/.test(buildAnalystPrompt(ctx)), 'tactical prompt lacks SIMULATED framing');
check(/SIMULATED/.test(buildQAPrompt(ctx, 'test')), 'QA prompt lacks SIMULATED framing');

// Deterministic tactical read cites win-prob.
const read = fallbackAnalysis(ctx);
check(/Title race:/.test(read) && /%/.test(read), 'fallback read missing title/win-prob');

// Grounded Q&A fallback.
const aTitle = fallbackAnswer(ctx, 'can Barça still win the league?');
const aBoot = fallbackAnswer(ctx, 'who is the top scorer?');
console.log(`  Q "can Barça win?" → ${aTitle}`);
console.log(`  Q "top scorer?"    → ${aBoot}`);
check(/%/.test(aTitle) && /Barcelona/.test(aTitle), 'title answer not grounded (win% + club)');
check(!!ctx.bootLeader && aBoot.includes(ctx.bootLeader.name) && /\d/.test(aBoot), 'scorer answer not grounded');

const race = titleRaceState(finalStandings);
console.log('\n========================================================');
console.log(` Champion (emergent): ${clubById.get(race.leaderId ?? '')?.name}` +
  (race.gapToSecond === 0 ? ' — on goal difference' : ` — by ${race.gapToSecond} pt(s)`));
if (failures.length) {
  console.log(' INVARIANTS: ❌ FAIL');
  for (const f of failures) console.log('   - ' + f);
  console.log('========================================================');
  throw new Error('Season verification FAILED');
}
console.log(' INVARIANTS: ✅ all green — totals & standings byte-identical to pre-enrichment 737;');
console.log('   goals≤sot≤shots; Σevents==goals; assists valid; no suspended credited;');
console.log('   ratings∈[4,10]; MOTM==top-rated; momentum matches xG edge; reproducible.');
console.log('========================================================');
