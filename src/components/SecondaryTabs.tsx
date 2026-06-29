// Secondary, tabbed analytics area (post-load, no streaming-hidden content).
// The mandatory core stays the hero above; these are the deeper, optional views.
//   Stats  — Golden Boot / Assists / Golden Glove
//   Tables — Home / Away / Form / xG (toggle), full P/W/D/L/GD/Pts
//   Match  — pick a fixture → momentum wave + timeline + ratings
//   Season — position worm line chart

import { useState } from 'react';
import type { MatchResult, StandingsRow } from '../data/types.ts';
import { clubs, players } from '../data/clubs.ts';
import { clubById, playerById } from '../data/lookups.ts';
import {
  deriveGoldenBoot,
  deriveAssistRace,
  deriveGoldenGlove,
  homeTable,
  awayTable,
  formTable,
  xgTable,
  derivePositionWorm,
} from '../engine/derive.ts';
import { MomentumWave } from './MomentumWave.tsx';
import { MatchTimeline } from './MatchTimeline.tsx';
import { PositionWormChart } from './PositionWormChart.tsx';
import { CrestBadge } from './CrestBadge.tsx';

type TabId = 'stats' | 'tables' | 'match' | 'season';
type TableVariant = 'home' | 'away' | 'form' | 'xg';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'stats', label: 'Stats' },
  { id: 'tables', label: 'Tables' },
  { id: 'match', label: 'Match' },
  { id: 'season', label: 'Season' },
];

const pn = (id: string) => playerById.get(id)?.name ?? id;
const cc = (id: string) => clubById.get(id)?.shortCode ?? id;

function MiniTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <div className="mini-table">
      <div className="mini-row mini-head">
        <span>#</span>
        <span>Club</span>
        <span>P</span>
        <span>W</span>
        <span>D</span>
        <span>L</span>
        <span>GD</span>
        <span>Pts</span>
      </div>
      {rows.map((r) => (
        <div key={r.teamId} className={`mini-row${r.position === 1 ? ' mini-leader' : ''}`}>
          <span>{r.position}</span>
          <span className="mini-club">
            <CrestBadge club={clubById.get(r.teamId)} size={18} />
            {cc(r.teamId)}
          </span>
          <span>{r.played}</span>
          <span>{r.w}</span>
          <span>{r.d}</span>
          <span>{r.l}</span>
          <span>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
          <span className="mini-pts">{r.points}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  results: MatchResult[];
  playedMatchdays: number;
}

export function SecondaryTabs({ results, playedMatchdays }: Props) {
  const [tab, setTab] = useState<TabId>('stats');
  const [variant, setVariant] = useState<TableVariant>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const played = results.filter((m) => m.matchday <= playedMatchdays);
  const empty = played.length === 0;

  const boot = deriveGoldenBoot(played).slice(0, 6);
  const assists = deriveAssistRace(played).slice(0, 6);
  const glove = deriveGoldenGlove(played, players);

  const tableFor: Record<TableVariant, StandingsRow[]> = {
    home: homeTable(played, clubs),
    away: awayTable(played, clubs),
    form: formTable(played, clubs),
    xg: xgTable(played, clubs),
  };

  const playedFixtures = [...played].reverse();
  const activeId =
    selectedId && playedFixtures.some((f) => f.id === selectedId)
      ? selectedId
      : (playedFixtures[0]?.id ?? null);
  const activeFixture = playedFixtures.find((f) => f.id === activeId) ?? null;

  const worm = derivePositionWorm(played, clubs);

  return (
    <section className="panel tabs-panel">
      <div className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-body">
        {empty && <p className="empty-note">Play a matchday to unlock the analytics.</p>}

        {!empty && tab === 'stats' && (
          <div className="stats-grid">
            <div className="lb">
              <h3 className="lb-title">Golden Boot</h3>
              {boot.map((s, i) => (
                <div key={s.playerId} className="lb-row">
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">{pn(s.playerId)} <span className="lb-club">{cc(s.clubId)}</span></span>
                  <span className="lb-val">{s.goals}</span>
                </div>
              ))}
            </div>
            <div className="lb">
              <h3 className="lb-title">Assists</h3>
              {assists.map((s, i) => (
                <div key={s.playerId} className="lb-row">
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">{pn(s.playerId)} <span className="lb-club">{cc(s.clubId)}</span></span>
                  <span className="lb-val">{s.assists}</span>
                </div>
              ))}
            </div>
            <div className="lb">
              <h3 className="lb-title">Golden Glove</h3>
              {glove.map((g, i) => (
                <div key={g.clubId} className="lb-row">
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">
                    {g.gkId ? pn(g.gkId) : cc(g.clubId)} <span className="lb-club">{cc(g.clubId)}</span>
                  </span>
                  <span className="lb-val">{g.cleanSheets}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!empty && tab === 'tables' && (
          <div>
            <div className="seg">
              {(['home', 'away', 'form', 'xg'] as TableVariant[]).map((v) => (
                <button
                  key={v}
                  className={`seg-btn${variant === v ? ' seg-btn--active' : ''}`}
                  onClick={() => setVariant(v)}
                >
                  {v === 'xg' ? 'xG' : v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <MiniTable rows={tableFor[variant]} />
          </div>
        )}

        {!empty && tab === 'match' && activeFixture && (
          <div>
            <div className="fx-picker">
              {playedFixtures.map((f) => (
                <button
                  key={f.id}
                  className={`fx-pick${f.id === activeId ? ' fx-pick--active' : ''}`}
                  onClick={() => setSelectedId(f.id)}
                >
                  MD{f.matchday} {cc(f.homeId)} {f.homeGoals}-{f.awayGoals} {cc(f.awayId)}
                </button>
              ))}
            </div>
            <MomentumWave fixture={activeFixture} />
            <MatchTimeline fixture={activeFixture} />
          </div>
        )}

        {!empty && tab === 'season' && <PositionWormChart worm={worm} />}
      </div>
    </section>
  );
}
