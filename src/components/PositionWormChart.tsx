// Season position "worm": each club's league position (1 at the top) after every
// matchday, one line per club in its kit colour. Pure SVG line chart.

import type { WormRow } from '../engine/derive.ts';
import { clubById } from '../data/lookups.ts';

const W = 640;
const H = 260;
const PAD_L = 30;
const PAD_R = 54;
const PAD_T = 18;
const PAD_B = 26;

export function PositionWormChart({ worm }: { worm: WormRow[] }) {
  const m = Math.max(0, ...worm.map((w) => w.positions.length));
  const nClubs = worm.length || 4;
  if (m === 0) {
    return <p className="empty-note">Play matchdays to chart the title race.</p>;
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xFor = (i: number) => PAD_L + (m === 1 ? plotW / 2 : (i / (m - 1)) * plotW);
  const yFor = (pos: number) => PAD_T + ((pos - 1) / (nClubs - 1)) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="worm-svg" role="img" aria-label="Position over the season">
      {/* position gridlines + labels */}
      {Array.from({ length: nClubs }, (_, k) => k + 1).map((pos) => (
        <g key={pos}>
          <line x1={PAD_L} y1={yFor(pos)} x2={W - PAD_R} y2={yFor(pos)} stroke="rgba(255,255,255,0.06)" />
          <text x={PAD_L - 8} y={yFor(pos) + 4} textAnchor="end" className="worm-axis">
            {pos}
          </text>
        </g>
      ))}
      {/* matchday labels */}
      {Array.from({ length: m }, (_, i) => i).map((i) => (
        <text key={i} x={xFor(i)} y={H - 8} textAnchor="middle" className="worm-axis">
          {i + 1}
        </text>
      ))}

      {worm.map((w) => {
        const club = clubById.get(w.clubId);
        const color = club?.primaryColor ?? '#8892a6';
        const pts = w.positions.map((p, i) => `${xFor(i)},${yFor(p)}`).join(' ');
        const last = w.positions.length - 1;
        return (
          <g key={w.clubId}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {w.positions.map((p, i) => (
              <circle key={i} cx={xFor(i)} cy={yFor(p)} r="3.5" fill={color} stroke="#0a0e17" strokeWidth="1.5" />
            ))}
            <text
              x={xFor(last) + 8}
              y={yFor(w.positions[last]) + 4}
              className="worm-label"
              style={{ fill: color }}
            >
              {club?.shortCode}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
