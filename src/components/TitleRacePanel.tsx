// Live title-race readout: Monte-Carlo win probability per club (animated bars)
// plus the clinch / magic-number status. Recomputes on every whistle, scrub and
// What-If edit — the most visible part of the live cascade.

import { motion } from 'framer-motion';
import type { ClinchInfo } from '../engine/derive.ts';
import { clubById } from '../data/lookups.ts';
import { CrestBadge } from './CrestBadge.tsx';

interface Props {
  odds: Record<string, number>;
  clinch: ClinchInfo | null;
  championId: string | null;
  seasonOver: boolean;
  started: boolean;
}

export function TitleRacePanel({ odds, clinch, championId, seasonOver, started }: Props) {
  const rows = Object.keys(odds)
    .map((clubId) => ({ clubId, pct: odds[clubId] }))
    .sort((a, b) => b.pct - a.pct || a.clubId.localeCompare(b.clubId));

  let status: string;
  let tone: 'champ' | 'live' | 'idle';
  if (seasonOver && championId) {
    status = `🏆 ${clubById.get(championId)?.name} — champions`;
    tone = 'champ';
  } else if (clinch?.clinched && championId) {
    status = `🏆 ${clubById.get(championId)?.name} have clinched the title`;
    tone = 'champ';
  } else if (clinch) {
    const leader = clubById.get(clinch.leaderId)?.shortCode ?? clinch.leaderId;
    const maxGettable = 3 * clinch.gamesLeft;
    status =
      clinch.magicNumber > maxGettable
        ? `Title race wide open — ${leader} top, no clinch in reach yet`
        : `${leader} top · magic number ${clinch.magicNumber}`;
    tone = 'live';
  } else {
    status = 'Press Simulate Final Whistle to begin';
    tone = 'idle';
  }

  return (
    <section className="panel titlerace-panel">
      <header className="panel-head">
        <h2>Title Race</h2>
        <span className="panel-sub">win probability · Monte Carlo</span>
      </header>

      <div className={`tr-status tr-status--${tone}`}>{status}</div>

      <div className="tr-bars">
        {rows.map((r) => {
          const club = clubById.get(r.clubId);
          return (
            <div className="tr-row" key={r.clubId}>
              <CrestBadge club={club} size={18} />
              <span className="tr-code">{club?.shortCode}</span>
              <div className="tr-track">
                <motion.div
                  className="tr-fill"
                  style={{ background: club?.primaryColor }}
                  animate={{ width: `${started ? r.pct : 0}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 28 }}
                />
              </div>
              <span className="tr-pct">{started ? `${r.pct}%` : '—'}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
