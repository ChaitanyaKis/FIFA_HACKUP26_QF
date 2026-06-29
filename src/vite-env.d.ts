/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Gemini key for local dev. Lives in .env (gitignored), never committed. */
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
