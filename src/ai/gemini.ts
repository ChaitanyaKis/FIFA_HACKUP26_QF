// The ONLY I/O in the AI feature: a single raw `fetch` to the Google Gemini
// `generateContent` endpoint. No SDK, no streaming (we typewriter client-side).
//
// Verified before writing (curl against the live endpoint):
//   - CORS preflight + POST succeed from a page origin with these exact headers.
//   - Errors return JSON: error.code / error.status / error.details[].reason.
//   - 2.5/3.x Flash think by default and thinking tokens eat maxOutputTokens, so
//     we set thinkingBudget:0 to guarantee the 600-token budget yields the answer.

/**
 * Pinned model. gemini-2.5-flash is GA/stable and free, and is reliably
 * available — the newer gemini-3.5-flash was returning 503 UNAVAILABLE
 * ("high demand") on 2026-06-29, so we pin 2.5-flash for a dependable live demo.
 * All Flash models share this contract; this is the only line to change.
 */
export const GEMINI_MODEL = 'gemini-2.5-flash';

const ENDPOINT = (model: string): string =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Why a live generation could not be used (drives the offline tag + fallback). */
export type AnalysisFailureKind =
  | 'rate-limit' // 429 free-tier limit
  | 'auth' // bad/expired key (400/401/403)
  | 'http' // other non-2xx
  | 'empty' // 200 but no usable text (e.g. blocked / MAX_TOKENS on thinking)
  | 'network'; // fetch rejected (offline, DNS, blocked)

export interface AnalysisError extends Error {
  kind: AnalysisFailureKind;
}

function makeError(kind: AnalysisFailureKind, message: string): AnalysisError {
  const err = new Error(message) as AnalysisError;
  err.kind = kind;
  return err;
}

/** Narrow an unknown caught value to its failure kind for the offline tag. */
export function failureKindOf(err: unknown): AnalysisFailureKind {
  if (err && typeof err === 'object' && 'kind' in err) {
    return (err as AnalysisError).kind;
  }
  return 'network';
}

interface GeminiPart {
  text?: string;
}

/**
 * Call Gemini once and return the joined text. Throws an AnalysisError on any
 * failure (the caller falls back to the deterministic analysis). Pass a
 * `signal` so a new whistle can abort an in-flight request.
 */
export async function generateAnalysis(
  prompt: string,
  systemInstruction: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT(GEMINI_MODEL), {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0.7,
          // Disable "thinking" so the token budget is spent on the answer, not
          // hidden reasoning (otherwise 2.5/3.x Flash can return empty text).
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal,
    });
  } catch (err) {
    // Aborts are surfaced as-is so the caller can ignore them.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw makeError('network', 'Network request to Gemini failed');
  }

  if (!res.ok) {
    const kind: AnalysisFailureKind =
      res.status === 429
        ? 'rate-limit'
        : res.status === 400 || res.status === 401 || res.status === 403
          ? 'auth'
          : 'http';
    throw makeError(kind, `Gemini responded ${res.status}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    // Malformed/non-JSON body (proxy/CDN/edge case) — keep it inside the error
    // contract so it's tagged "API error" and falls back cleanly.
    throw makeError('http', 'Gemini returned a malformed response');
  }
  const parts =
    (data as { candidates?: { content?: { parts?: GeminiPart[] } }[] })
      ?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? '')
    .join('')
    .trim();

  if (!text) throw makeError('empty', 'Gemini returned no text');
  return text;
}
