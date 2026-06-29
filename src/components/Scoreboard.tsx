// Current matchday's fixtures with animated final scores. The score pops in on
// each whistle (the fixture set, and thus the keys, change every matchday).

import { motion } from 'framer-motion';
import type { MatchResult } from '../data/types.ts';
import { teamById } from '../data/lookups.ts';
import { pickMOTM } from '../engine/engine.ts';
import { players } from '../data/season.ts';

interface Props {
  matchday: number;
  fixtures: MatchResult[];
}

export function Scoreboard({ matchday, fixtures }: Props) {
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
        <span className="panel-sub">Matchday {matchday} — full time</span>
      </header>

      <div className="fixtures">
        {fixtures.map((fx) => {
          const home = teamById.get(fx.homeId);
          const away = teamById.get(fx.awayId);
          const motm = pickMOTM(fx, players);
          const homeWin = fx.homeGoals > fx.awayGoals;
          const awayWin = fx.awayGoals > fx.homeGoals;

          return (
            <div className="fixture" key={fx.id}>
              <div className={`fx-team fx-home${homeWin ? ' fx-win' : ''}`}>
                <span
                  className="team-dot"
                  style={{ background: home?.color }}
                />
                <span className="fx-name">{home?.name}</span>
              </div>

              <motion.div
                className="fx-score"
                key={fx.id}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 480, damping: 18 }}
              >
                {fx.homeGoals}
                <span className="fx-dash">–</span>
                {fx.awayGoals}
              </motion.div>

              <div className={`fx-team fx-away${awayWin ? ' fx-win' : ''}`}>
                <span className="fx-name">{away?.name}</span>
                <span
                  className="team-dot"
                  style={{ background: away?.color }}
                />
              </div>

              {motm && (
                <div className="fx-motm">
                  <span className="motm-star">★</span> MOTM:{' '}
                  <strong>{motm.name}</strong>{' '}
                  <span className="motm-team">
                    {teamById.get(motm.teamId)?.shortCode}
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
