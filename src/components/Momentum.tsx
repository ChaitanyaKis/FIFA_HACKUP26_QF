// Small per-fixture momentum indicator. The bar swings out from the centre
// toward whichever side carried the xG, scaled by the size of the swing. Reads
// straight from `computeMomentum` (xG swing in the log).

import { motion } from 'framer-motion';
import type { MatchResult } from '../data/types.ts';
import { computeMomentum } from '../engine/engine.ts';
import { teamById } from '../data/lookups.ts';

/** A swing of this many xG fills the meter completely. */
const MOMENTUM_FULL_SCALE = 2.0;

export function Momentum({ fixture }: { fixture: MatchResult }) {
  const m = computeMomentum(fixture);
  const dominant = m.dominantId ? teamById.get(m.dominantId) : null;
  const homeDominant = m.dominantId === fixture.homeId;

  const fillPct = Math.min(
    100,
    (Math.abs(m.swing) / MOMENTUM_FULL_SCALE) * 100,
  );
  const readout = dominant
    ? `${dominant.shortCode} +${Math.abs(m.swing).toFixed(1)} xG`
    : 'Balanced';

  return (
    <div className="momentum">
      <div className="mom-head">
        <span className="mom-label">Momentum</span>
        <span className="mom-read" style={{ color: dominant?.color }}>
          {readout}
        </span>
      </div>
      <div className="mom-track">
        <div className="mom-half mom-half-home">
          {homeDominant && (
            <motion.span
              className="mom-fill mom-fill-home"
              style={{ background: dominant?.color }}
              key={`${fixture.id}-h`}
              initial={{ width: '0%' }}
              animate={{ width: `${fillPct}%` }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
            />
          )}
        </div>
        <span className="mom-center" />
        <div className="mom-half mom-half-away">
          {m.dominantId === fixture.awayId && (
            <motion.span
              className="mom-fill mom-fill-away"
              style={{ background: dominant?.color }}
              key={`${fixture.id}-a`}
              initial={{ width: '0%' }}
              animate={{ width: `${fillPct}%` }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
