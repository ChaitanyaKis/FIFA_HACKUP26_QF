import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import './App.css';
import { appReducer, initialState } from './state/matchLogReducer.ts';
import { simulateSeason, reEnrichFixture } from './sim/engine.ts';
import { clubs, players, SQUAD_SNAPSHOT_DATE } from './data/clubs.ts';
import { computeStandings, titleRaceState, pickMatchdayMOTM } from './engine/engine.ts';
import {
  monteCarloTitleOdds,
  deriveTitleRace,
  deriveGoldenBoot,
  deriveAnalystRecord,
  predictMatchday,
} from './engine/derive.ts';
import { clubById, playerById } from './data/lookups.ts';
import type { MatchResult } from './data/types.ts';
import { StandingsTable } from './components/StandingsTable.tsx';
import { Scoreboard } from './components/Scoreboard.tsx';
import { StatBars } from './components/StatBars.tsx';
import { ControlBar } from './components/ControlBar.tsx';
import { MOTMCard } from './components/MOTMCard.tsx';
import { AnalystDesk } from './components/AnalystDesk.tsx';
import { TitleRacePanel } from './components/TitleRacePanel.tsx';
import { WhatIfEditor } from './components/WhatIfEditor.tsx';
import { SecondaryTabs } from './components/SecondaryTabs.tsx';
import { ChampionsMoment } from './components/ChampionsMoment.tsx';
import { playWhistle, playRoar, setMuted } from './lib/sound.ts';
import type { AnalystContext } from './ai/analyst.ts';

const clubIds = clubs.map((c) => c.id);

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { seed, curatedIndex, playedMatchdays, edits } = state;

  // The whole season derives from the mutable SEED; What-If edits re-enrich
  // individual fixtures on top. EVERYTHING below is recomputed from these.
  const baseSeason = useMemo(
    () => simulateSeason(seed, clubIds, players),
    [seed],
  );
  const effectiveSeason = useMemo<MatchResult[]>(
    () =>
      baseSeason.map((m) => {
        const e = edits[m.id];
        return e
          ? reEnrichFixture(m, e.homeGoals, e.awayGoals, players, {
              homeScorers: e.homeScorers,
              awayScorers: e.awayScorers,
            })
          : m;
      }),
    [baseSeason, edits],
  );

  const total = useMemo(
    () => (effectiveSeason.length ? Math.max(...effectiveSeason.map((m) => m.matchday)) : 0),
    [effectiveSeason],
  );
  const playedSlice = useMemo(
    () => effectiveSeason.filter((m) => m.matchday <= playedMatchdays),
    [effectiveSeason, playedMatchdays],
  );
  const standings = useMemo(() => computeStandings(playedSlice, clubs), [playedSlice]);
  const race = useMemo(() => titleRaceState(standings), [standings]);
  const currentFixtures = useMemo(
    () => effectiveSeason.filter((m) => m.matchday === playedMatchdays),
    [effectiveSeason, playedMatchdays],
  );
  const matchdayMOTM = useMemo(
    () => (playedMatchdays > 0 ? pickMatchdayMOTM(effectiveSeason, players, playedMatchdays) : null),
    [effectiveSeason, playedMatchdays],
  );
  const winOdds = useMemo(
    () =>
      playedMatchdays > 0
        ? monteCarloTitleOdds(
            playedSlice,
            effectiveSeason.filter((m) => m.matchday > playedMatchdays),
            clubs,
            { runs: 1500 },
          )
        : Object.fromEntries(clubIds.map((id) => [id, 0])),
    [playedSlice, effectiveSeason, playedMatchdays],
  );
  const titleRaceFull = useMemo(() => deriveTitleRace(effectiveSeason, clubs), [effectiveSeason]);
  const currentClinch = playedMatchdays > 0 ? titleRaceFull.perMatchday[playedMatchdays - 1] : null;

  const bootLeader = useMemo(() => {
    const top = deriveGoldenBoot(playedSlice)[0];
    return top
      ? { name: playerById.get(top.playerId)?.name ?? top.playerId, clubId: top.clubId, goals: top.goals }
      : null;
  }, [playedSlice]);
  const analystRecord = useMemo(
    () => deriveAnalystRecord(effectiveSeason, playedMatchdays),
    [effectiveSeason, playedMatchdays],
  );
  const upcomingPrediction = useMemo(
    () => (playedMatchdays < total ? predictMatchday(effectiveSeason, playedMatchdays + 1) : []),
    [effectiveSeason, playedMatchdays, total],
  );

  const seasonOver = playedMatchdays >= total;
  const leaderId = standings[0]?.teamId ?? null;
  const championName =
    seasonOver && leaderId ? (clubById.get(leaderId)?.name ?? leaderId) : null;
  const hasEdits = Object.keys(edits).length > 0;

  const [muted, setMutedState] = useState(false);
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // One-shot gold flash + crowd roar when the leader changes (not on first mount).
  const prevLeaderRef = useRef<string | null>(null);
  const [flashLeaderId, setFlashLeaderId] = useState<string | null>(null);
  useEffect(() => {
    const prev = prevLeaderRef.current;
    prevLeaderRef.current = leaderId;
    if (prev === null || leaderId === null || leaderId === prev) return;
    setFlashLeaderId(leaderId);
    playRoar();
    const timer = setTimeout(() => setFlashLeaderId(null), 1400);
    return () => clearTimeout(timer);
  }, [leaderId]);

  // CHAMPIONS moment when the title is clinched (false -> true transition).
  const prevClinchedRef = useRef(false);
  const [showChampions, setShowChampions] = useState(false);
  useEffect(() => {
    const now = currentClinch?.clinched ?? false;
    const prev = prevClinchedRef.current;
    prevClinchedRef.current = now;
    if (now && !prev) {
      setShowChampions(true);
      playRoar(true);
      const t = setTimeout(() => setShowChampions(false), 5500);
      return () => clearTimeout(t);
    }
  }, [currentClinch, leaderId]);

  // "Simulate to end" auto-play.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (playedMatchdays >= total) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      playWhistle();
      dispatch({ type: 'SET_PLAYED', matchdays: playedMatchdays + 1 });
    }, 950);
    return () => clearTimeout(t);
  }, [playing, playedMatchdays, total]);

  // What-If editor.
  const [editFixtureId, setEditFixtureId] = useState<string | null>(null);
  const editFixture = editFixtureId
    ? (effectiveSeason.find((m) => m.id === editFixtureId) ?? null)
    : null;
  const editedIds = useMemo(() => new Set(Object.keys(edits)), [edits]);

  const leaderName = race.leaderId
    ? (clubById.get(race.leaderId)?.name ?? race.leaderId)
    : '—';

  const analystContext = useMemo<AnalystContext | null>(
    () =>
      playedMatchdays === 0
        ? null
        : {
            matchday: playedMatchdays,
            totalMatchdays: total,
            fixtures: currentFixtures,
            standings,
            race,
            motm: matchdayMOTM,
            winProb: winOdds,
            bootLeader,
            magicNumber: currentClinch?.magicNumber ?? null,
            clinched: currentClinch?.clinched ?? false,
            leaderId,
          },
    [
      playedMatchdays,
      total,
      currentFixtures,
      standings,
      race,
      matchdayMOTM,
      winOdds,
      bootLeader,
      currentClinch,
      leaderId,
    ],
  );

  return (
    <div className={`app${showChampions ? ' celebrate' : ''}`}>
      <header className="broadcast-header">
        <div className="header-left">
          <span className="logo-mark">⚽</span>
          <div className="title-block">
            <h1 className="title">League Standings</h1>
            <p className="subtitle">Live Performance Analytics Portal</p>
          </div>
        </div>

        <div className="header-right">
          <button
            type="button"
            className="mute-btn"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <span className="sim-tag" title="All matches are computer-simulated">
            SIMULATED
          </span>
          <div className="title-race" aria-live="polite">
            <span className="tr-label">Leader</span>
            <span className="tr-leader">{leaderName}</span>
            {playedMatchdays > 0 && (
              <span className="tr-gap">
                {race.gapToSecond === 0
                  ? 'level on points'
                  : `+${race.gapToSecond} pt${race.gapToSecond === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
          <motion.div
            className="live-badge"
            aria-label={seasonOver ? 'Full time' : 'Live'}
            animate={seasonOver ? { opacity: 0.6 } : { opacity: [1, 0.45, 1] }}
            transition={
              seasonOver
                ? { duration: 0.3 }
                : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <span className="live-dot" />
            {seasonOver ? 'FT' : 'LIVE'}
          </motion.div>
        </div>
      </header>

      <ControlBar
        seed={seed}
        isRandom={curatedIndex < 0}
        playedMatchdays={playedMatchdays}
        total={total}
        seasonOver={seasonOver}
        championName={championName}
        hasEdits={hasEdits}
        playing={playing}
        onWhistle={() => {
          playWhistle();
          dispatch({ type: 'SET_PLAYED', matchdays: Math.min(playedMatchdays + 1, total) });
        }}
        onSimulateToEnd={() => {
          if (playedMatchdays < total) setPlaying(true);
        }}
        onReset={() => {
          setPlaying(false);
          dispatch({ type: 'NEXT_CURATED' });
        }}
        onSurprise={() => {
          setPlaying(false);
          dispatch({ type: 'RANDOM_SEED', seed: 1 + Math.floor(Math.random() * 1_000_000) });
        }}
        onScrub={(n) => {
          setPlaying(false);
          dispatch({ type: 'SET_PLAYED', matchdays: n });
        }}
        onRevertEdits={() => dispatch({ type: 'REVERT_EDITS' })}
      />

      <MOTMCard spotlight={matchdayMOTM} />

      <main className="stage">
        <div className="main-col">
          <StandingsTable standings={standings} flashLeaderId={flashLeaderId} />
          <TitleRacePanel
            odds={winOdds}
            clinch={currentClinch}
            championId={currentClinch?.clinched ? leaderId : null}
            seasonOver={seasonOver}
            started={playedMatchdays > 0}
          />
        </div>
        <div className="side-col">
          <Scoreboard
            matchday={playedMatchdays}
            fixtures={currentFixtures}
            onEditFixture={(fx) => setEditFixtureId(fx.id)}
            editedIds={editedIds}
          />
          <StatBars matchday={playedMatchdays} fixtures={currentFixtures} />
          <AnalystDesk
            context={analystContext}
            upcoming={upcomingPrediction}
            upcomingMatchday={playedMatchdays + 1}
            record={analystRecord}
          />
        </div>
      </main>

      <div className="secondary">
        <SecondaryTabs results={effectiveSeason} playedMatchdays={playedMatchdays} />
      </div>

      <footer className="app-footer">
        Real clubs — all matches are simulated (squad snapshot{' '}
        {SQUAD_SNAPSHOT_DATE}). Standings, stats, MOTM, form, win-probability and
        What-If all derive from a single simulated match-log. Crests:
        luukhopman/football-logos · kit colours: Wikipedia/Wikimedia.
      </footer>

      {showChampions && leaderId && (
        <ChampionsMoment
          club={clubById.get(leaderId)}
          onClose={() => setShowChampions(false)}
        />
      )}

      {editFixture && (
        <WhatIfEditor
          fixture={editFixture}
          isEdited={editedIds.has(editFixture.id)}
          onApply={(edit) => {
            dispatch({ type: 'APPLY_EDIT', fixtureId: editFixture.id, edit });
            setEditFixtureId(null);
          }}
          onRevert={() => {
            dispatch({ type: 'REVERT_ONE', fixtureId: editFixture.id });
            setEditFixtureId(null);
          }}
          onClose={() => setEditFixtureId(null)}
        />
      )}
    </div>
  );
}

export default App;
