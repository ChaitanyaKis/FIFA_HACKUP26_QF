// The league table — the headline interactive feature.
//
// Each row carries framer-motion `layout`, so when `computeStandings` returns a
// new order after a whistle, the rows physically SLIDE to their new positions
// (FLIP). Keys are teamIds (never indices) so framer-motion tracks each club.
// First place gets a gold highlight + glow; a one-shot gold flash fires on the
// row whose team has just become the new leader.

import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { StandingsRow } from '../data/types.ts';
import { clubById } from '../data/lookups.ts';
import { FormPips } from './FormPips.tsx';
import { CrestBadge } from './CrestBadge.tsx';

interface Props {
  standings: StandingsRow[];
  flashLeaderId: string | null;
}

export function StandingsTable({ standings, flashLeaderId }: Props) {
  return (
    <section className="panel standings-panel">
      <header className="panel-head">
        <h2>League Table</h2>
        <span className="panel-sub">Live standings — derived from the match-log</span>
      </header>

      <div className="standings">
        <div className="standings-row standings-headrow" aria-hidden="true">
          <span className="col-pos">#</span>
          <span className="col-team">Team</span>
          <span className="col-num">P</span>
          <span className="col-num">W</span>
          <span className="col-num">D</span>
          <span className="col-num">L</span>
          <span className="col-num col-gd">GD</span>
          <span className="col-pts">Pts</span>
          <span className="col-form">Form</span>
        </div>

        {standings.map((row) => {
          const club = clubById.get(row.teamId);
          const isLeader = row.position === 1;
          const rowStyle = {
            '--team-color': club?.primaryColor ?? '#8892a6',
            '--team-2': club?.secondaryColor ?? '#8892a6',
          } as CSSProperties;
          const gd = row.gd > 0 ? `+${row.gd}` : String(row.gd);

          return (
            <motion.div
              key={row.teamId}
              layout
              transition={{ layout: { type: 'spring', stiffness: 520, damping: 36 } }}
              className={`standings-row${isLeader ? ' is-leader' : ''}`}
              style={rowStyle}
            >
              {flashLeaderId === row.teamId && (
                <motion.span
                  className="leader-flash"
                  initial={{ opacity: 0.95 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  aria-hidden="true"
                />
              )}

              <span className="col-pos">
                <span className="pos-num">{row.position}</span>
                {isLeader && (
                  <span className="crown" title="League leader">
                    ★
                  </span>
                )}
              </span>
              <span className="col-team">
                <CrestBadge club={club} size={24} />
                <span className="team-accent" />
                <span className="team-name">{club?.name ?? row.teamId}</span>
                <span className="team-code">{club?.shortCode}</span>
              </span>
              <span className="col-num">{row.played}</span>
              <span className="col-num">{row.w}</span>
              <span className="col-num">{row.d}</span>
              <span className="col-num">{row.l}</span>
              <span className="col-num col-gd">{gd}</span>
              <span className="col-pts">{row.points}</span>
              <span className="col-form">
                <FormPips form={row.form} />
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
