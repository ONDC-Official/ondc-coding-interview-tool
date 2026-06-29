import * as monaco from 'monaco-editor';
// Side-effect import: registers the Monaco web workers before any editor is
// created (see monaco-setup.ts).
import './monaco-setup';

import type { Theme } from './theme';

export type LanguageId = 'python' | 'javascript' | 'java' | 'cpp' | 'text';

export interface LanguageOption {
  value: LanguageId;
  label: string;
}

// Languages offered in the selector. `value` is what gets stored in the shared
// Yjs doc so both peers resolve to the same highlighting.
export const LANGUAGES: LanguageOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'text', label: 'Plain Text (.txt)' },
];

export const DEFAULT_LANGUAGE: LanguageId = 'python';

// Maps a stored language value to Monaco's language id. Monaco calls plain text
// "plaintext" and C++ "cpp"; the rest line up with our own ids.
export function monacoLanguage(value: string): string {
  switch (value) {
    case 'python':
      return 'python';
    case 'java':
      return 'java';
    case 'cpp':
      return 'cpp';
    case 'text':
      return 'plaintext';
    case 'javascript':
    default:
      return 'javascript';
  }
}

// Monaco's built-in light/dark themes, picked to match the app theme. Swapped at
// runtime with monaco.editor.setTheme (global), so toggling never tears the
// editor down or drops the collab connection.
export function monacoTheme(theme: Theme): string {
  return theme === 'dark' ? 'vs-dark' : 'vs';
}

// Editor options shared by every session. Autocomplete / suggestion popups are
// deliberately disabled: this is a DSA interview surface, and the previous
// editor intentionally shipped without them, so we keep that behaviour. Tab and
// auto-indent use 4 spaces (set on the model too); word wrap is on; the minimap
// is hidden for a cleaner, distraction-free surface.
export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
  fontLigatures: false,
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  renderWhitespace: 'selection',
  padding: { top: 12, bottom: 12 },
  scrollbar: { useShadows: false },
  // No autocomplete: the interview editor is intentionally suggestion-free.
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: 'off',
  parameterHints: { enabled: false },
  tabCompletion: 'off',
  // Browser autocorrect / spellcheck off so typing code stays untouched.
  ariaLabel: 'Code editor',
};

// WebSocket backend URL.
//  - VITE_WS_URL (optional) is an explicit override.
//  - In dev the backend runs on its own port (default 1234). We derive the host
//    from the page URL so it works whether you open localhost OR a LAN/remote IP
//    (e.g. http://13.233.69.163:5173 -> ws://13.233.69.163:1234).
//  - In a production build the single server serves both, so use same origin.
const WS_PORT = import.meta.env.VITE_WS_PORT || '1234';
// In prod the WS shares the page origin AND its sub-path (the reverse proxy
// strips the prefix before forwarding). WebsocketProvider appends "/<roomId>",
// so include the base path here (without its trailing slash).
const BASE_NO_SLASH = import.meta.env.BASE_URL.replace(/\/$/, '');
export const WS_URL: string =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? `ws://${location.hostname}:${WS_PORT}`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${BASE_NO_SLASH}`);

export interface LocalUser {
  name: string;
  color: string;
  colorLight: string;
}

// Distinct, readable colors for remote cursors/selections on a dark theme.
const USER_COLORS = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#c77dff', light: '#c77dff33' },
  { color: '#f25c54', light: '#f25c5433' },
];

const ADJECTIVES = ['Quick', 'Calm', 'Brave', 'Sharp', 'Witty', 'Bright'];
const ANIMALS = ['Fox', 'Owl', 'Lynx', 'Wolf', 'Hawk', 'Otter'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// A random identity for this tab: a friendly name + a cursor color.
export function makeLocalUser(): LocalUser {
  const c = pick(USER_COLORS);
  return {
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: c.color,
    colorLight: c.light,
  };
}
