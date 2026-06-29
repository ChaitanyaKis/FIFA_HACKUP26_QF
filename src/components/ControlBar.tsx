// The control deck. Drives the whole state machine: reveal matchdays (Final
// Whistle / Simulate-to-end / scrubber), switch seasons (Reset → next curated
// seed, Surprise → random seed), and the active-seed readout + What-If revert.

import { motion } from 'framer-motion';

interface Props {
  seed: number;
  isRandom: boolean;
  playedMatchdays: number;
  total: number;
  seasonOver: boolean;
  championName: string | null;
  hasEdits: boolean;
  playing: boolean;
  onWhistle: () => void;
  onSimulateToEnd: () => void;
  onReset: () => void;
  onSurprise: () => void;
  onScrub: (n: number) => void;
  onRevertEdits: () => void;
}

export function ControlBar({
  seed,
  isRandom,
  playedMatchdays,
  total,
  seasonOver,
  championName,
  hasEdits,
  playing,
  onWhistle,
  onSimulateToEnd,
  onReset,
  onSurprise,
  onScrub,
  onRevertEdits,
}: Props) {
  const next = Math.min(playedMatchdays + 1, total);

  return (
    <div className="control-wrap">
      <div className="control-bar">
        <div className="control-status">
          <span className="season-chip" title="Active season seed">
            Season #{seed}
            {isRandom && <span className="season-chip-tag">random</span>}
          </span>
          {hasEdits && <span className="whatif-chip">WHAT-IF</span>}
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
                ? `Kickoff — Matchday ${next} of ${total}`
                : `Matchday ${playedMatchdays} of ${total}`}
            </span>
          )}
        </div>

        <div className="control-actions">
          {hasEdits && (
            <button type="button" className="btn btn-reset" onClick={onRevertEdits}>
              Revert What-If
            </button>
          )}
          <button
            type="button"
            className="btn btn-whistle"
            onClick={onWhistle}
            disabled={seasonOver || playing}
          >
            <span className="whistle-dot" />
            Simulate Final Whistle
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onSimulateToEnd}
            disabled={seasonOver || playing}
          >
            Simulate to end
          </button>
          <button type="button" className="btn btn-reset" onClick={onReset}>
            Reset Season
          </button>
          <button type="button" className="btn btn-reset" onClick={onSurprise}>
            Surprise me
          </button>
        </div>
      </div>

      <div className="scrubber">
        <span className="scrub-label">Scrub season</span>
        <input
          type="range"
          className="scrub-range"
          min={0}
          max={total}
          step={1}
          value={playedMatchdays}
          disabled={playing}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Matchday scrubber"
        />
        <span className="scrub-val">
          MD {playedMatchdays} / {total}
        </span>
      </div>
    </div>
  );
}
