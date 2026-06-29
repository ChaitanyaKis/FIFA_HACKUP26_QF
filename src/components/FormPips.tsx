// W/D/L form guide as colored pips. Shows the most recent results (newest last).

import type { FormResult } from '../data/types.ts';

const PIP_TITLE: Record<FormResult, string> = {
  W: 'Win',
  D: 'Draw',
  L: 'Loss',
};

export function FormPips({ form }: { form: FormResult[] }) {
  const recent = form.slice(-5);
  return (
    <div
      className="form-pips"
      aria-label={`Form, oldest to newest: ${recent.join(' ') || 'none yet'}`}
    >
      {recent.length === 0 && <span className="pip pip-empty">–</span>}
      {recent.map((r, i) => (
        <span key={i} className={`pip pip-${r}`} title={PIP_TITLE[r]}>
          {r}
        </span>
      ))}
    </div>
  );
}
