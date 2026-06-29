// What-If editor: pick a fixture and rewrite the scoreline (and, optionally, the
// scorer for each goal). Applying it dispatches an edit that re-derives the whole
// cascade (standings/GD/position/form/win-prob/clinch) and FLIPs the table.

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { MatchResult, Player } from '../data/types.ts';
import type { WhatIfEdit } from '../state/matchLogReducer.ts';
import { players } from '../data/clubs.ts';
import { clubById } from '../data/lookups.ts';

interface Props {
  fixture: MatchResult;
  isEdited: boolean;
  onApply: (edit: WhatIfEdit) => void;
  onRevert: () => void;
  onClose: () => void;
}

const MAX_GOALS = 9;

function scorersFor(fixture: MatchResult, clubId: string): string[] {
  return fixture.goalEvents.filter((g) => g.clubId === clubId).map((g) => g.scorerId);
}

function resize(arr: string[], n: number): string[] {
  const out = arr.slice(0, n);
  while (out.length < n) out.push('');
  return out;
}

export function WhatIfEditor({ fixture, isEdited, onApply, onRevert, onClose }: Props) {
  const home = clubById.get(fixture.homeId);
  const away = clubById.get(fixture.awayId);
  const suspended = new Set(fixture.suspended);
  const eligible = (clubId: string): Player[] =>
    players.filter((p) => p.clubId === clubId && p.position !== 'GK' && !suspended.has(p.id));

  const [homeGoals, setHomeGoals] = useState(fixture.homeGoals);
  const [awayGoals, setAwayGoals] = useState(fixture.awayGoals);
  const [homeScorers, setHomeScorers] = useState<string[]>(scorersFor(fixture, fixture.homeId));
  const [awayScorers, setAwayScorers] = useState<string[]>(scorersFor(fixture, fixture.awayId));

  const setGoals = (sideHome: boolean, n: number) => {
    const v = Math.max(0, Math.min(MAX_GOALS, n));
    if (sideHome) {
      setHomeGoals(v);
      setHomeScorers((s) => resize(s, v));
    } else {
      setAwayGoals(v);
      setAwayScorers((s) => resize(s, v));
    }
  };

  const apply = () =>
    onApply({
      homeGoals,
      awayGoals,
      homeScorers: resize(homeScorers, homeGoals),
      awayScorers: resize(awayScorers, awayGoals),
    });

  const renderSide = (
    clubId: string,
    label: string | undefined,
    goals: number,
    scorers: string[],
    setScorers: (s: string[]) => void,
    sideHome: boolean,
  ) => {
    const pool = eligible(clubId);
    return (
      <div className="wi-side">
        <div className="wi-club">{label}</div>
        <div className="wi-stepper">
          <button type="button" onClick={() => setGoals(sideHome, goals - 1)} aria-label="fewer goals">−</button>
          <span className="wi-goals">{goals}</span>
          <button type="button" onClick={() => setGoals(sideHome, goals + 1)} aria-label="more goals">+</button>
        </div>
        <div className="wi-scorers">
          {Array.from({ length: goals }).map((_, i) => (
            <select
              key={i}
              className="wi-select"
              value={scorers[i] ?? ''}
              onChange={(e) => {
                const next = resize(scorers, goals);
                next[i] = e.target.value;
                setScorers(next);
              }}
            >
              <option value="">Auto scorer</option>
              {pool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="wi-backdrop" onClick={onClose}>
      <motion.div
        className="wi-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      >
        <header className="wi-head">
          <span className="wi-kicker">What-If · Matchday {fixture.matchday}</span>
          <h3>
            {home?.name} vs {away?.name}
          </h3>
        </header>

        <div className="wi-grid">
          {renderSide(fixture.homeId, home?.name, homeGoals, homeScorers, setHomeScorers, true)}
          <div className="wi-vs">{homeGoals} – {awayGoals}</div>
          {renderSide(fixture.awayId, away?.name, awayGoals, awayScorers, setAwayScorers, false)}
        </div>

        <footer className="wi-actions">
          {isEdited && (
            <button type="button" className="btn-link" onClick={onRevert}>
              Revert this fixture
            </button>
          )}
          <div className="wi-actions-right">
            <button type="button" className="btn btn-reset" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-whistle" onClick={apply}>
              Apply What-If
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
