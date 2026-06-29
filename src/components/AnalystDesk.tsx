// The creative feature: a two-way AI Performance Analyst with a track record.
//
//  1. Deep tactical read of each matchday (xG/momentum/win-prob), auto on whistle.
//  2. Ask-the-analyst: free-form questions answered grounded in the live data.
//  3. Prediction + accuracy tracker: the analyst calls each matchday; results are
//     graded into a season-long record.
//
// Gemini (gemini-2.5-flash, runtime key in memory) with a deterministic, grounded
// fallback for no-key / error / 429. The season is always framed as SIMULATED.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AnalystContext } from '../ai/analyst.ts';
import {
  ANALYST_SYSTEM,
  ANALYST_QA_SYSTEM,
  buildAnalystPrompt,
  buildQAPrompt,
  fallbackAnalysis,
  fallbackAnswer,
} from '../ai/analyst.ts';
import { GEMINI_MODEL, generateAnalysis, failureKindOf } from '../ai/gemini.ts';
import type { AnalysisFailureKind } from '../ai/gemini.ts';
import type { MatchPrediction, AnalystRecord } from '../engine/derive.ts';
import { clubById } from '../data/lookups.ts';

interface Props {
  context: AnalystContext | null;
  upcoming: MatchPrediction[];
  upcomingMatchday: number;
  record: AnalystRecord;
}

type Source = 'live' | 'offline';

const OFFLINE: Record<AnalysisFailureKind | 'no-key', string> = {
  'no-key': 'No key — deterministic',
  'rate-limit': 'Rate limit (429) — deterministic',
  auth: 'Key rejected — deterministic',
  http: 'API error — deterministic',
  empty: 'Empty response — deterministic',
  network: 'Network issue — deterministic',
};

const SUGGESTIONS = [
  'Can Barça still win the league?',
  "Who's the form player?",
  'Why did the result go that way?',
];

function useTypewriter(text: string) {
  const [typed, setTyped] = useState('');
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (ref.current) {
      clearInterval(ref.current);
      ref.current = null;
    }
    if (!text) {
      setTyped('');
      return;
    }
    setTyped('');
    let i = 0;
    ref.current = window.setInterval(() => {
      i += 3;
      setTyped(text.slice(0, i));
      if (i >= text.length && ref.current) {
        clearInterval(ref.current);
        ref.current = null;
      }
    }, 18);
    return () => {
      if (ref.current) {
        clearInterval(ref.current);
        ref.current = null;
      }
    };
  }, [text]);
  const skip = useCallback(() => {
    if (ref.current) {
      clearInterval(ref.current);
      ref.current = null;
    }
    setTyped(text);
  }, [text]);
  return { typed, isTyping: typed.length < text.length, skip };
}

export function AnalystDesk({ context, upcoming, upcomingMatchday, record }: Props) {
  const envKey = import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY ?? '') : '';
  const [apiKey, setApiKey] = useState(envKey);
  const apiKeyRef = useRef(apiKey);
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  // ── Tactical read (auto per matchday) ──
  const [readText, setReadText] = useState('');
  const [readSource, setReadSource] = useState<Source | null>(null);
  const [readReason, setReadReason] = useState<string | null>(null);
  const [readLoading, setReadLoading] = useState(false);
  const readAbort = useRef<AbortController | null>(null);
  const autoRan = useRef<number | null>(null);
  const read = useTypewriter(readText);

  const runRead = useCallback(async (ctx: AnalystContext) => {
    readAbort.current?.abort();
    const ctrl = new AbortController();
    readAbort.current = ctrl;
    setReadLoading(true);
    setReadSource(null);
    setReadReason(null);
    setReadText('');
    const key = apiKeyRef.current.trim();
    if (!key) {
      setReadSource('offline');
      setReadReason(OFFLINE['no-key']);
      setReadText(fallbackAnalysis(ctx));
      setReadLoading(false);
      return;
    }
    try {
      const t = await generateAnalysis(buildAnalystPrompt(ctx), ANALYST_SYSTEM, key, ctrl.signal);
      setReadSource('live');
      setReadText(t);
      setReadLoading(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setReadSource('offline');
      setReadReason(OFFLINE[failureKindOf(err)]);
      setReadText(fallbackAnalysis(ctx));
      setReadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!context) {
      autoRan.current = null;
      setReadText('');
      setReadSource(null);
      setReadLoading(false);
      return;
    }
    if (autoRan.current === context.matchday) return;
    autoRan.current = context.matchday;
    void runRead(context);
  }, [context, runRead]);

  // ── Ask-the-analyst (two-way) ──
  const [question, setQuestion] = useState('');
  const [qaAsked, setQaAsked] = useState('');
  const [qaText, setQaText] = useState('');
  const [qaSource, setQaSource] = useState<Source | null>(null);
  const [qaReason, setQaReason] = useState<string | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const qaAbort = useRef<AbortController | null>(null);
  const qa = useTypewriter(qaText);

  const ask = useCallback(
    async (raw: string) => {
      const ctx = context;
      const q = raw.trim();
      if (!ctx || !q) return;
      setQaAsked(q);
      qaAbort.current?.abort();
      const ctrl = new AbortController();
      qaAbort.current = ctrl;
      setQaLoading(true);
      setQaSource(null);
      setQaReason(null);
      setQaText('');
      const key = apiKeyRef.current.trim();
      if (!key) {
        setQaSource('offline');
        setQaReason(OFFLINE['no-key']);
        setQaText(fallbackAnswer(ctx, q));
        setQaLoading(false);
        return;
      }
      try {
        const t = await generateAnalysis(buildQAPrompt(ctx, q), ANALYST_QA_SYSTEM, key, ctrl.signal);
        setQaSource('live');
        setQaText(t);
        setQaLoading(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setQaSource('offline');
        setQaReason(OFFLINE[failureKindOf(err)]);
        setQaText(fallbackAnswer(ctx, q));
        setQaLoading(false);
      }
    },
    [context],
  );

  const started = context !== null;
  const code = (id: string) => clubById.get(id)?.shortCode ?? id;

  return (
    <section className="panel analyst-panel">
      <header className="panel-head">
        <h2>AI Performance Analyst</h2>
        <span className={`analyst-status analyst-status--${readSource ?? 'idle'}`}>
          {readLoading ? (
            <>
              <span className="ad-dot ad-dot--load" /> Analysing…
            </>
          ) : readSource === 'live' ? (
            <>
              <span className="ad-dot ad-dot--live" /> Live · {GEMINI_MODEL}
            </>
          ) : readSource === 'offline' ? (
            <>
              <span className="ad-dot ad-dot--offline" /> Offline
            </>
          ) : (
            'Analyst desk'
          )}
        </span>
      </header>

      <div className="analyst-keyrow">
        <input
          type="password"
          className="analyst-keyinput"
          placeholder="Gemini API key (optional) — enables live AI"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Gemini API key"
        />
        <p className="analyst-keyhint">
          Free key from Google AI Studio (make a NEW key). In memory only, never
          saved. Works without a key via grounded fallback.
        </p>
      </div>

      {/* Track record + the analyst's call for the next matchday */}
      <div className="analyst-record">
        <span className="rec-label">Track record</span>
        <span className="rec-score">
          {record.total > 0 ? `${record.correct}/${record.total} correct` : 'no calls yet'}
        </span>
        <span className="rec-ticks">
          {record.fixtures.slice(-8).map((f, i) => (
            <span key={i} className={`rec-tick ${f.correct ? 'rec-hit' : 'rec-miss'}`}>
              {f.correct ? '✓' : '✗'}
            </span>
          ))}
        </span>
      </div>
      {upcoming.length > 0 && (
        <div className="analyst-call">
          <span className="call-label">Analyst calls MD{upcomingMatchday}:</span>{' '}
          {upcoming
            .map((p) => `${code(p.homeId)} ${p.predHome}-${p.predAway} ${code(p.awayId)}`)
            .join(' · ')}
        </div>
      )}

      {/* Tactical read */}
      <div className="analyst-body">
        {!started ? (
          <p className="empty-note">
            Play a matchday — the analyst files a tactical report and takes your
            questions.
          </p>
        ) : (
          <>
            <motion.p
              key={readText}
              className="analyst-text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {read.typed}
              {read.isTyping && <span className="analyst-caret" />}
            </motion.p>
            <div className="analyst-foot">
              {readSource === 'offline' && readReason && (
                <span className="analyst-tag">{readReason}</span>
              )}
              <div className="analyst-actions">
                {read.isTyping && (
                  <button type="button" className="btn-link" onClick={read.skip}>
                    Skip
                  </button>
                )}
                {context && !readLoading && (
                  <button type="button" className="btn-link" onClick={() => runRead(context)}>
                    Re-run
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Ask the analyst */}
      {started && (
        <div className="analyst-qa">
          <div className="qa-suggest">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="qa-chip"
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="qa-inputrow">
            <input
              type="text"
              className="qa-input"
              placeholder="Ask the analyst…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask(question);
              }}
              aria-label="Ask the analyst a question"
            />
            <button
              type="button"
              className="btn btn-whistle qa-ask"
              onClick={() => void ask(question)}
              disabled={qaLoading || !question.trim()}
            >
              Ask
            </button>
          </div>
          {qaAsked && (
            <div className="qa-answer">
              <p className="qa-q">“{qaAsked}”</p>
              <p className="qa-a">
                {qaLoading ? 'Thinking…' : qa.typed}
                {qa.isTyping && <span className="analyst-caret" />}
              </p>
              {qaSource === 'offline' && qaReason && (
                <span className="analyst-tag">{qaReason}</span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
