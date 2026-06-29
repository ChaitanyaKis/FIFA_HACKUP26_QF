// The creative feature: a live "AI Performance Analyst" desk.
//
// After each whistle it reads the matchday's derived data and writes a short,
// data-driven tactical/statistical analysis, typed out live. With a valid
// Gemini key it uses the model; with no key, a 429, or any failure it falls back
// to a deterministic analysis grounded in the same numbers — so it never dies.
//
// The API key lives in React state ONLY (in-memory). It is never persisted.

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AnalystContext } from '../ai/analyst.ts';
import {
  ANALYST_SYSTEM,
  buildAnalystPrompt,
  fallbackAnalysis,
} from '../ai/analyst.ts';
import {
  GEMINI_MODEL,
  generateAnalysis,
  failureKindOf,
} from '../ai/gemini.ts';
import type { AnalysisFailureKind } from '../ai/gemini.ts';

interface Props {
  context: AnalystContext | null;
}

type Source = 'live' | 'offline';
type Status = 'idle' | 'loading' | 'ready';

const OFFLINE_REASON: Record<AnalysisFailureKind | 'no-key', string> = {
  'no-key': 'No key — deterministic analysis',
  'rate-limit': 'Rate limit (429) — deterministic analysis',
  auth: 'Key rejected — deterministic analysis',
  http: 'API error — deterministic analysis',
  empty: 'Empty response — deterministic analysis',
  network: 'Network issue — deterministic analysis',
};

export function AnalystDesk({ context }: Props) {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
  const [apiKey, setApiKey] = useState(envKey);
  const [status, setStatus] = useState<Status>('idle');
  const [source, setSource] = useState<Source | null>(null);
  const [offlineReason, setOfflineReason] = useState<string | null>(null);
  const [fullText, setFullText] = useState('');
  const [typed, setTyped] = useState('');

  // Latest key without re-triggering generation on every keystroke.
  const apiKeyRef = useRef(apiKey);
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  // Guards against races: only the newest request may apply its result.
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const typeTimerRef = useRef<number | null>(null);

  function stopTyping() {
    if (typeTimerRef.current !== null) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
  }

  async function run(ctx: AnalystContext) {
    const reqId = ++reqIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setSource(null);
    setOfflineReason(null);
    setTyped('');
    setFullText('');

    const key = apiKeyRef.current.trim();
    const prompt = buildAnalystPrompt(ctx);

    if (!key) {
      if (reqId !== reqIdRef.current) return;
      setSource('offline');
      setOfflineReason(OFFLINE_REASON['no-key']);
      setFullText(fallbackAnalysis(ctx));
      setStatus('ready');
      return;
    }

    try {
      const text = await generateAnalysis(
        prompt,
        ANALYST_SYSTEM,
        key,
        controller.signal,
      );
      if (reqId !== reqIdRef.current) return;
      setSource('live');
      setFullText(text);
      setStatus('ready');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (reqId !== reqIdRef.current) return;
      setSource('offline');
      setOfflineReason(OFFLINE_REASON[failureKindOf(err)]);
      setFullText(fallbackAnalysis(ctx));
      setStatus('ready');
    }
  }

  // Auto-generate whenever a new matchday is whistled in.
  useEffect(() => {
    if (!context) {
      setStatus('idle');
      setFullText('');
      setTyped('');
      setSource(null);
      return;
    }
    void run(context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  // Typewriter: reveal fullText progressively.
  useEffect(() => {
    stopTyping();
    if (!fullText) {
      setTyped('');
      return;
    }
    setTyped('');
    let i = 0;
    typeTimerRef.current = window.setInterval(() => {
      i += 3;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) stopTyping();
    }, 18);
    return stopTyping;
  }, [fullText]);

  const isTyping = status === 'ready' && typed.length < fullText.length;

  return (
    <section className="panel analyst-panel">
      <header className="panel-head">
        <h2>AI Performance Analyst</h2>
        <span className={`analyst-status analyst-status--${source ?? 'idle'}`}>
          {status === 'loading' ? (
            <>
              <span className="ad-dot ad-dot--load" /> Analysing…
            </>
          ) : source === 'live' ? (
            <>
              <span className="ad-dot ad-dot--live" /> Live · {GEMINI_MODEL}
            </>
          ) : source === 'offline' ? (
            <>
              <span className="ad-dot ad-dot--offline" /> Offline analysis
            </>
          ) : (
            'Analyst desk'
          )}
        </span>
      </header>

      <div className="analyst-keyrow">
        <label className="analyst-keylabel" htmlFor="gemini-key">
          Gemini API key
        </label>
        <input
          id="gemini-key"
          type="password"
          className="analyst-keyinput"
          placeholder="Paste key to enable live AI analysis"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="analyst-keyhint">
          Free key from Google AI Studio — make a NEW key (legacy keys are
          deprecated). Stored in memory only, never saved.
        </p>
      </div>

      <div className="analyst-body">
        {status === 'idle' ? (
          <p className="empty-note">
            Play a matchday — the analyst reads the data and files a report.
          </p>
        ) : (
          <>
            <motion.p
              key={fullText}
              className="analyst-text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {typed}
              {isTyping && <span className="analyst-caret" />}
            </motion.p>

            <div className="analyst-foot">
              {source === 'offline' && offlineReason && (
                <span className="analyst-tag">{offlineReason}</span>
              )}
              <div className="analyst-actions">
                {isTyping && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      stopTyping();
                      setTyped(fullText);
                    }}
                  >
                    Skip
                  </button>
                )}
                {context && status === 'ready' && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => void run(context)}
                  >
                    Re-run
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
