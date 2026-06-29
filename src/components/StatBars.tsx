// Per-fixture match analytics: clean labeled rows (home value · label · away
// value) above an animated split bar, plus a momentum read. The home fill
// animates its width from 0 on each whistle; the away color shows through the
// track. All values come from computeMatchStats, so they always match the
// scoreboard.

import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { MatchResult } from '../data/types.ts';
import { computeMatchStats } from '../engine/engine.ts';
import { teamById } from '../data/lookups.ts';
import { Momentum } from './Momentum.tsx';

interface Props {
  matchday: number;
  fixtures: MatchResult[];
}

/** Home share of a home/away pair as a 0-100 percentage. */
function homeShare(home: number, away: number): number {
  const total = home + away;
  return total === 0 ? 50 : (home / total) * 100;
}

export function StatBars({ matchday, fixtures }: Props) {
  if (fixtures.length === 0) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2>Match Analytics</h2>
          <span className="panel-sub">No data yet</span>
        </header>
        <p className="empty-note">Stat bars appear once a matchday is played.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Match Analytics</h2>
        <span className="panel-sub">
          Matchday {matchday} — possession · shots · xG
        </span>
      </header>

      <div className="analytics">
        {fixtures.map((fx) => {
          const home = teamById.get(fx.homeId);
          const away = teamById.get(fx.awayId);
          const stats = computeMatchStats(fx);

          const metrics = [
            {
              label: 'Possession',
              frac: stats.possession.home,
              hv: `${stats.possession.home}%`,
              av: `${stats.possession.away}%`,
              homeLead: stats.possession.home > stats.possession.away,
              awayLead: stats.possession.away > stats.possession.home,
            },
            {
              label: 'Shots',
              frac: homeShare(stats.shots.home, stats.shots.away),
              hv: String(stats.shots.home),
              av: String(stats.shots.away),
              homeLead: stats.shots.home > stats.shots.away,
              awayLead: stats.shots.away > stats.shots.home,
            },
            {
              label: 'xG',
              frac: homeShare(stats.xg.home, stats.xg.away),
              hv: stats.xg.home.toFixed(1),
              av: stats.xg.away.toFixed(1),
              homeLead: stats.xg.home > stats.xg.away,
              awayLead: stats.xg.away > stats.xg.home,
            },
          ];

          const trackStyle = {
            '--away-color': away?.color ?? '#8892a6',
          } as CSSProperties;

          return (
            <div className="analytics-card" key={fx.id}>
              <div className="ac-head">
                <span className="ac-team" style={{ color: home?.color }}>
                  {home?.shortCode}
                </span>
                <span className="ac-vs">vs</span>
                <span className="ac-team" style={{ color: away?.color }}>
                  {away?.shortCode}
                </span>
              </div>

              {metrics.map((m) => (
                <div className="stat-row" key={m.label}>
                  <span
                    className={`stat-val${m.homeLead ? ' is-lead' : ''}`}
                    style={m.homeLead ? { color: home?.color } : undefined}
                  >
                    {m.hv}
                  </span>
                  <span className="stat-label">{m.label}</span>
                  <span
                    className={`stat-val stat-val--right${m.awayLead ? ' is-lead' : ''}`}
                    style={m.awayLead ? { color: away?.color } : undefined}
                  >
                    {m.av}
                  </span>
                  <div className="stat-track" style={trackStyle}>
                    <motion.div
                      className="stat-fill"
                      style={{ background: home?.color }}
                      key={`${fx.id}-${m.label}`}
                      initial={{ width: '0%' }}
                      animate={{ width: `${m.frac}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}

              <Momentum fixture={fx} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
