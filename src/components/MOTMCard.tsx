// Man of the Match as a broadcast "lower-third" graphic: a team-color accent
// bar, a "MAN OF THE MATCH" kicker, the player's name, and a key stat line
// (goals · team xG). It slides in from the left on every whistle and swaps to
// the new matchday's standout via AnimatePresence.

import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { MotmSpotlight } from '../data/types.ts';
import { clubById } from '../data/lookups.ts';
import { CrestBadge } from './CrestBadge.tsx';

interface Props {
  spotlight: MotmSpotlight | null;
}

export function MOTMCard({ spotlight }: Props) {
  return (
    <div className="lower-third-wrap">
      <AnimatePresence mode="wait" initial={false}>
        {spotlight ? (
          <LowerThird key={spotlight.matchId} spotlight={spotlight} />
        ) : (
          <motion.div
            key="placeholder"
            className="lower-third lower-third--empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="lt-accent" />
            <div className="lt-body">
              <span className="lt-kicker">★ Man of the Match</span>
              <span className="lt-name lt-name--muted">Awaiting first whistle…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LowerThird({ spotlight }: { spotlight: MotmSpotlight }) {
  const club = clubById.get(spotlight.teamId);
  const opp = clubById.get(spotlight.opponentId);
  const style = { '--team-color': club?.primaryColor ?? '#8892a6' } as CSSProperties;
  const resultWord = spotlight.won
    ? 'in the win'
    : spotlight.scoreline.split('-')[0] === spotlight.scoreline.split('-')[1]
      ? 'in the draw'
      : 'despite defeat';

  return (
    <motion.div
      className="lower-third"
      style={style}
      initial={{ x: -90, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -50, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
    >
      <span className="lt-accent" />
      <CrestBadge club={club} size={40} />
      <div className="lt-body">
        <span className="lt-kicker">
          ★ Man of the Match · Matchday {spotlight.matchday}
        </span>
        <span className="lt-name">{spotlight.player.name}</span>
        <span className="lt-team">
          {club?.name}
          <span className="lt-sep">·</span>
          {spotlight.scoreline} vs {opp?.shortCode} {resultWord}
        </span>
      </div>
      <div className="lt-stats">
        <div className="lt-stat">
          <span className="lt-stat-val">{spotlight.goals}</span>
          <span className="lt-stat-label">{spotlight.goals === 1 ? 'Goal' : 'Goals'}</span>
        </div>
        <div className="lt-stat">
          <span className="lt-stat-val">{spotlight.teamXG.toFixed(1)}</span>
          <span className="lt-stat-label">Team xG</span>
        </div>
      </div>
    </motion.div>
  );
}
