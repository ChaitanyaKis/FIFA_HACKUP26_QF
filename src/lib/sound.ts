// Broadcast SFX synthesized with the Web Audio API — no external assets (CSP-safe).
// A referee whistle (on Final Whistle) and a crowd roar (on a lead change),
// both gated by a mute flag. The AudioContext is created/resumed on first use,
// which always follows a user gesture (a button click), satisfying autoplay rules.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}
export function isMuted(): boolean {
  return muted;
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Referee whistle: high vibrato tone — two short pips then a long blast. */
export function playWhistle(): void {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime;
  const blasts: Array<[number, number]> = [
    [0, 0.12],
    [0.16, 0.12],
    [0.34, 0.36],
  ];
  for (const [start, dur] of blasts) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const vib = c.createOscillator();
    const vibGain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 2750;
    vib.type = 'sine';
    vib.frequency.value = 16;
    vibGain.gain.value = 55;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    const a = t0 + start;
    gain.gain.setValueAtTime(0, a);
    gain.gain.linearRampToValueAtTime(0.16, a + 0.02);
    gain.gain.setValueAtTime(0.16, a + dur - 0.05);
    gain.gain.linearRampToValueAtTime(0, a + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(a);
    vib.start(a);
    osc.stop(a + dur);
    vib.stop(a + dur);
  }
}

/** Crowd roar: band-passed noise with a swell, on a lead change / clinch. */
export function playRoar(big = false): void {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = big ? 2.2 : 1.4;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 650;
  filter.Q.value = 0.6;
  const gain = c.createGain();
  const peak = big ? 0.32 : 0.24;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.35);
  gain.gain.linearRampToValueAtTime(peak * 0.7, t0 + dur * 0.6);
  gain.gain.linearRampToValueAtTime(0, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur);
}
