// Current matchday's fixtures with animated final scores. The score pops in on
// each whistle (the fixture set, and thus the keys, change every matchday).

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MatchResult } from '../data/types.ts';
import { clubById } from '../data/lookups.ts';
import { pickMOTM } from '../engine/engine.ts';
import { players } from '../data/clubs.ts';
import { rivalryOf } from '../data/rivalries.ts';
import { CrestBadge } from './CrestBadge.tsx';

/** Counts a final score up from 0 — a small broadcast flourish at full time. */
function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (value <= 0) return;
    let cur = 0;
    const id = window.setInterval(() => {
      cur += 1;
      setN(cur);
      if (cur >= value) clearInterval(id);
    }, 130);
    return () => clearInterval(id);
  }, [value]);
  return <>{n}</>;
}

interface Props {
  matchday: number;
  fixtures: MatchResult[];
  onEditFixture?: (fixture: MatchResult) => void;
  editedIds?: Set<string>;
}

export function Scoreboard({ matchday, fixtures, onEditFixture, editedIds }: Props) {
  if (fixtures.length === 0) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2>Scoreboard</h2>
          <span className="panel-sub">Awaiting kickoff</span>
        </header>
        <p className="empty-note">
          Press <strong>Simulate Final Whistle</strong> to play Matchday 1.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Scoreboard</h2>
        <span className="panel-sub">
          Matchday {matchday} — {onEditFixture ? 'tap a fixture to run a What-If' : 'full time'}
        </span>
      </header>

      <div className="fixtures">
        {fixtures.map((fx) => {
          const home = clubById.get(fx.homeId);
          const away = clubById.get(fx.awayId);
          const motm = pickMOTM(fx, players);
          const homeWin = fx.homeGoals > fx.awayGoals;
          const awayWin = fx.awayGoals > fx.homeGoals;
          const edited = editedIds?.has(fx.id);
          const derby = rivalryOf(fx.homeId, fx.awayId);

          return (
            <div
              className={`fixture${onEditFixture ? ' fixture--editable' : ''}${edited ? ' fixture--edited' : ''}${derby ? ' fixture--derby' : ''}`}
              key={fx.id}
              role={onEditFixture ? 'button' : undefined}
              tabIndex={onEditFixture ? 0 : undefined}
              onClick={onEditFixture ? () => onEditFixture(fx) : undefined}
              onKeyDown={
                onEditFixture
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEditFixture(fx);
                      }
                    }
                  : undefined
              }
            >
              {edited && <span className="fixture-edit-tag">WHAT-IF</span>}
              {derby && <span className="fx-derby">★ {derby}</span>}
              <div className={`fx-team fx-home${homeWin ? ' fx-win' : ''}`}>
                <CrestBadge club={home} size={20} />
                <span className="fx-name">{home?.name}</span>
              </div>

              <motion.div
                className="fx-score"
                key={fx.id}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 18 }}
              >
                <CountUp value={fx.homeGoals} />
                <span className="fx-dash">–</span>
                <CountUp value={fx.awayGoals} />
              </motion.div>

              <div className={`fx-team fx-away${awayWin ? ' fx-win' : ''}`}>
                <span className="fx-name">{away?.name}</span>
                <CrestBadge club={away} size={20} />
              </div>

              {motm && (
                <div className="fx-motm">
                  <span className="motm-star">★</span> MOTM:{' '}
                  <strong>{motm.name}</strong>{' '}
                  <span className="motm-team">
                    {clubById.get(motm.clubId)?.shortCode}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
