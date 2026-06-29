import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import './App.css';
import { matchLogReducer, initialState } from './state/matchLogReducer.ts';
import { season, teams, players, TOTAL_MATCHDAYS } from './data/season.ts';
import {
  computeStandings,
  titleRaceState,
  pickMatchdayMOTM,
} from './engine/engine.ts';
import { teamById } from './data/lookups.ts';
import { StandingsTable } from './components/StandingsTable.tsx';
import { Scoreboard } from './components/Scoreboard.tsx';
import { StatBars } from './components/StatBars.tsx';
import { ControlBar } from './components/ControlBar.tsx';
import { MOTMCard } from './components/MOTMCard.tsx';
import { AnalystDesk } from './components/AnalystDesk.tsx';
import type { AnalystContext } from './ai/analyst.ts';

function App() {
  const [state, dispatch] = useReducer(matchLogReducer, initialState);
  const { playedMatchdays } = state;

  // EVERYTHING below is DERIVED from the played slice of the match-log.
  // Nothing derived is ever stored — change `playedMatchdays` and it recomputes.
  const playedSlice = useMemo(
    () => season.filter((m) => m.matchday <= playedMatchdays),
    [playedMatchdays],
  );
  const standings = useMemo(
    () => computeStandings(playedSlice, teams),
    [playedSlice],
  );
  const race = useMemo(() => titleRaceState(standings), [standings]);
  const currentFixtures = useMemo(
    () => season.filter((m) => m.matchday === playedMatchdays),
    [playedMatchdays],
  );
  const matchdayMOTM = useMemo(
    () =>
      playedMatchdays > 0
        ? pickMatchdayMOTM(season, players, playedMatchdays)
        : null,
    [playedMatchdays],
  );
  const analystContext = useMemo<AnalystContext | null>(
    () =>
      playedMatchdays === 0
        ? null
        : {
            matchday: playedMatchdays,
            totalMatchdays: TOTAL_MATCHDAYS,
            fixtures: currentFixtures,
            standings,
            race,
            motm: matchdayMOTM,
          },
    [playedMatchdays, currentFixtures, standings, race, matchdayMOTM],
  );

  const seasonOver = playedMatchdays >= TOTAL_MATCHDAYS;
  const leaderId = standings[0]?.teamId ?? null;
  const championName =
    seasonOver && leaderId ? (teamById.get(leaderId)?.name ?? leaderId) : null;

  // One-shot gold flash when the leader CHANGES (not on first mount / no-op).
  const prevLeaderRef = useRef<string | null>(null);
  const [flashLeaderId, setFlashLeaderId] = useState<string | null>(null);
  useEffect(() => {
    const prev = prevLeaderRef.current;
    prevLeaderRef.current = leaderId;
    if (prev === null || leaderId === null || leaderId === prev) return;
    setFlashLeaderId(leaderId);
    const timer = setTimeout(() => setFlashLeaderId(null), 1400);
    return () => clearTimeout(timer);
  }, [leaderId]);

  const leaderName = race.leaderId
    ? (teamById.get(race.leaderId)?.name ?? race.leaderId)
    : '—';

  return (
    <div className="app">
      <header className="broadcast-header">
        <div className="header-left">
          <span className="logo-mark">⚽</span>
          <div className="title-block">
            <h1 className="title">League Standings</h1>
            <p className="subtitle">Live Performance Analytics Portal</p>
          </div>
        </div>

        <div className="header-right">
          <div className="title-race" aria-live="polite">
            <span className="tr-label">Title race</span>
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
            animate={
              seasonOver ? { opacity: 0.6 } : { opacity: [1, 0.45, 1] }
            }
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
        playedMatchdays={playedMatchdays}
        total={TOTAL_MATCHDAYS}
        seasonOver={seasonOver}
        championName={championName}
        onWhistle={() => dispatch({ type: 'SIMULATE_FINAL_WHISTLE' })}
        onReset={() => dispatch({ type: 'RESET' })}
      />

      <MOTMCard spotlight={matchdayMOTM} />

      <main className="stage">
        <StandingsTable standings={standings} flashLeaderId={flashLeaderId} />
        <div className="side-col">
          <AnalystDesk context={analystContext} />
          <Scoreboard matchday={playedMatchdays} fixtures={currentFixtures} />
          <StatBars matchday={playedMatchdays} fixtures={currentFixtures} />
        </div>
      </main>

      <footer className="app-footer">
        All teams, players and results are fictional — no real clubs, people or
        leagues. Standings, stats, MOTM and form are derived from a single
        match-log.
      </footer>
    </div>
  );
}

export default App;
