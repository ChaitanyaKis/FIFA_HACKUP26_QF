// The control deck: the prominent "Simulate Final Whistle" button with a
// pulsing LIVE dot, a matchday status readout, and a Reset that appears once
// the season is under way. The whistle disables at full time.

import { motion } from 'framer-motion';

interface Props {
  playedMatchdays: number;
  total: number;
  seasonOver: boolean;
  championName: string | null;
  onWhistle: () => void;
  onReset: () => void;
}

export function ControlBar({
  playedMatchdays,
  total,
  seasonOver,
  championName,
  onWhistle,
  onReset,
}: Props) {
  const nextMatchday = Math.min(playedMatchdays + 1, total);

  return (
    <div className="control-bar">
      <div className="control-status">
        {seasonOver ? (
          <span className="status-full">
            <span className="ft-badge">FULL TIME</span>
            <span>
              Champions: <strong>{championName}</strong>
            </span>
          </span>
        ) : (
          <span className="status-live">
            <motion.span
              className="live-dot"
              animate={{ opacity: [1, 0.35, 1], scale: [1, 0.8, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {playedMatchdays === 0
              ? `Kickoff — Matchday ${nextMatchday} of ${total}`
              : `Up next — Matchday ${nextMatchday} of ${total}`}
          </span>
        )}
      </div>

      <div className="control-actions">
        <button
          type="button"
          className="btn btn-whistle"
          onClick={onWhistle}
          disabled={seasonOver}
        >
          <span className="whistle-dot" />
          Simulate Final Whistle
        </button>
        {playedMatchdays > 0 && (
          <button type="button" className="btn btn-reset" onClick={onReset}>
            Reset Season
          </button>
        )}
      </div>
    </div>
  );
}
