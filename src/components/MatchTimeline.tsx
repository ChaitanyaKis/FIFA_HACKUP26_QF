// Vertical 0-90' match timeline (goals + cards in minute order) plus the player
// ratings for the fixture, coloured by band; MOTM (top-rated) is flagged.

import type { MatchResult } from '../data/types.ts';
import { clubById, playerById } from '../data/lookups.ts';

interface TLEvent {
  minute: number;
  kind: 'goal' | 'yellow' | 'red';
  clubId: string;
  text: string;
}

const ratingBand = (r: number) => (r >= 7.5 ? 'rate-hi' : r >= 6.5 ? 'rate-mid' : 'rate-lo');

export function MatchTimeline({ fixture }: { fixture: MatchResult }) {
  const pn = (id: string) => playerById.get(id)?.name ?? id;
  const home = clubById.get(fixture.homeId);
  const away = clubById.get(fixture.awayId);

  const events: TLEvent[] = [
    ...fixture.goalEvents.map((g) => ({
      minute: g.minute,
      kind: 'goal' as const,
      clubId: g.clubId,
      text: g.assistId ? `${pn(g.scorerId)} (assist ${pn(g.assistId)})` : pn(g.scorerId),
    })),
    ...fixture.cards.map((c) => ({
      minute: c.minute,
      kind: c.type,
      clubId: c.clubId,
      text: pn(c.playerId),
    })),
  ].sort((a, b) => a.minute - b.minute);

  const ratings = [...fixture.ratings].sort((a, b) => b.rating - a.rating);
  const icon = (k: TLEvent['kind']) => (k === 'goal' ? '⚽' : k === 'yellow' ? '🟨' : '🟥');

  return (
    <div className="timeline-wrap">
      <div className="timeline">
        <div className="tl-head">
          {home?.shortCode} {fixture.homeGoals}–{fixture.awayGoals} {away?.shortCode}
        </div>
        <ol className="tl-list">
          {events.length === 0 && <li className="tl-empty">No goals or cards.</li>}
          {events.map((e, i) => {
            const club = clubById.get(e.clubId);
            const right = e.clubId === fixture.awayId;
            return (
              <li key={i} className={`tl-row${right ? ' tl-row--away' : ''}`}>
                <span className="tl-min">{e.minute}&apos;</span>
                <span className="tl-icon">{icon(e.kind)}</span>
                <span className="tl-text">
                  <span className="tl-dot" style={{ background: club?.primaryColor }} />
                  {e.text}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="ratings">
        <div className="ratings-head">Player ratings</div>
        <ol className="ratings-list">
          {ratings.map((r) => {
            const isMotm = r.playerId === fixture.motmId;
            return (
              <li key={r.playerId} className="rt-row">
                <span className="rt-name">
                  {pn(r.playerId)}
                  <span className="rt-club">{clubById.get(r.clubId)?.shortCode}</span>
                  {isMotm && <span className="rt-motm">MOTM</span>}
                </span>
                <span className={`rt-val ${ratingBand(r.rating)}`}>{r.rating.toFixed(1)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
