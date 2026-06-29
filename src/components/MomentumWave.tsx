// FIFA-style momentum broadcast graphic: G1's signed per-minute momentum series
// as a flowing area wave — home club's color above the centreline, away below —
// with goal-event markers aligned to their minutes. Pure SVG, no deps.

import type { MatchResult } from '../data/types.ts';
import { clubById } from '../data/lookups.ts';

const W = 640;
const H = 200;
const PAD_Y = 22;
const CENTER = H / 2;

interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom → cubic bezier for a smooth flowing line. */
function smooth(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function MomentumWave({ fixture }: { fixture: MatchResult }) {
  const home = clubById.get(fixture.homeId);
  const away = clubById.get(fixture.awayId);
  const homeColor = home?.primaryColor ?? '#8892a6';
  const awayColor = away?.primaryColor ?? '#8892a6';

  const series = fixture.momentum;
  const n = series.length || 1;
  const maxAbs = Math.max(1, ...series.map((v) => Math.abs(v)));
  const yScale = (CENTER - PAD_Y) / maxAbs;

  const pts: Pt[] = series.map((v, i) => ({
    x: ((i + 0.5) / n) * W,
    y: CENTER - v * yScale,
  }));
  const line = smooth(pts);
  const area = `${line} L ${W},${CENTER} L 0,${CENTER} Z`;
  const uid = fixture.id.replace(/[^a-z0-9]/gi, '');

  const minuteX = (m: number) => (Math.min(m, 90) / 90) * W;

  return (
    <figure className="wave">
      <figcaption className="wave-cap">
        <span style={{ color: homeColor }}>● {home?.shortCode}</span>
        <span className="wave-cap-mid">momentum</span>
        <span style={{ color: awayColor }}>{away?.shortCode} ●</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="wave-svg"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Momentum: ${home?.shortCode} above, ${away?.shortCode} below`}
      >
        <defs>
          <clipPath id={`top-${uid}`}>
            <rect x="0" y="0" width={W} height={CENTER} />
          </clipPath>
          <clipPath id={`bot-${uid}`}>
            <rect x="0" y={CENTER} width={W} height={CENTER} />
          </clipPath>
          <linearGradient id={`gh-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={homeColor} stopOpacity="0.75" />
            <stop offset="100%" stopColor={homeColor} stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={`ga-${uid}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={awayColor} stopOpacity="0.75" />
            <stop offset="100%" stopColor={awayColor} stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* minute gridlines */}
        {[15, 30, 45, 60, 75].map((m) => (
          <line
            key={m}
            x1={minuteX(m)}
            y1="0"
            x2={minuteX(m)}
            y2={H}
            stroke="rgba(255,255,255,0.06)"
          />
        ))}

        <path d={area} fill={`url(#gh-${uid})`} clipPath={`url(#top-${uid})`} />
        <path d={area} fill={`url(#ga-${uid})`} clipPath={`url(#bot-${uid})`} />
        <line x1="0" y1={CENTER} x2={W} y2={CENTER} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <path d={line} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />

        {/* goal markers */}
        {fixture.goalEvents.map((g, i) => {
          const x = minuteX(g.minute);
          const homeGoal = g.clubId === fixture.homeId;
          const tipY = homeGoal ? CENTER - (CENTER - PAD_Y) : CENTER + (CENTER - PAD_Y);
          const color = homeGoal ? homeColor : awayColor;
          return (
            <g key={i}>
              <line x1={x} y1={CENTER} x2={x} y2={tipY} stroke={color} strokeWidth="2" strokeDasharray="2 2" />
              <circle cx={x} cy={tipY} r="5" fill={color} stroke="#111316" strokeWidth="1.5" />
              <text
                x={x}
                y={homeGoal ? tipY - 8 : tipY + 16}
                textAnchor="middle"
                className="wave-goal-label"
              >
                {g.minute}&apos;
              </text>
            </g>
          );
        })}
      </svg>
      <div className="wave-axis">
        <span>0&apos;</span>
        <span>45&apos;</span>
        <span>90&apos;</span>
      </div>
    </figure>
  );
}
