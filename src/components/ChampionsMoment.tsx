// The CHAMPIONS broadcast moment: a gold lower-third + tasteful confetti, shown
// when the title is mathematically clinched. Self-contained canvas confetti (no
// deps). Gold is permitted here — this is the champion moment.

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Club } from '../data/types.ts';
import { CrestBadge } from './CrestBadge.tsx';

const COLORS = ['#f2c94c', '#2be8ff', '#eef2fb', '#27e0a0'];

export function ChampionsMoment({ club, onClose }: { club: Club | undefined; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cctx = canvas.getContext('2d');
    if (!cctx) return;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    const W = () => canvas.width;
    const H = () => canvas.height;

    type P = { x: number; y: number; vx: number; vy: number; s: number; rot: number; vr: number; c: string };
    const N = 170;
    const parts: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * W(),
      y: -Math.random() * H() * 0.5,
      vx: (Math.random() - 0.5) * 2.2 * dpr,
      vy: (1.5 + Math.random() * 2.5) * dpr,
      s: (4 + Math.random() * 6) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const tick = () => {
      cctx.clearRect(0, 0, W(), H());
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02 * dpr;
        p.rot += p.vr;
        if (p.y > H() + 20) {
          p.y = -20;
          p.x = Math.random() * W();
          p.vy = (1.5 + Math.random() * 2.5) * dpr;
        }
        cctx.save();
        cctx.translate(p.x, p.y);
        cctx.rotate(p.rot);
        cctx.fillStyle = p.c;
        cctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        cctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="champs" onClick={onClose}>
      <canvas ref={canvasRef} className="champs-canvas" />
      <motion.div
        className="champs-lower"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <span className="champs-trophy">🏆</span>
        <CrestBadge club={club} size={56} />
        <div className="champs-text">
          <span className="champs-kicker">Champions</span>
          <span className="champs-name">{club?.name}</span>
        </div>
      </motion.div>
      <span className="champs-dismiss">click to dismiss</span>
    </div>
  );
}
