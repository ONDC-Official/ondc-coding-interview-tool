import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';

// Languages offered in the selector. `value` is what gets stored in the shared
// Yjs doc so both peers resolve to the same highlighting.
export const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
];

export const DEFAULT_LANGUAGE = 'python';

// Returns the CodeMirror language extension for a stored language value.
export function langExtension(value) {
  switch (value) {
    case 'python':
      return python();
    case 'java':
      return java();
    case 'cpp':
      return cpp();
    case 'javascript':
    default:
      return javascript();
  }
}

// WebSocket backend URL.
//  - VITE_WS_URL (optional) is an explicit override.
//  - In dev the backend runs on its own port (default 1234). We derive the host
//    from the page URL so it works whether you open localhost OR a LAN IP
//    (e.g. http://192.168.x.x:5173 -> ws://192.168.x.x:1234).
//  - In a production build the single server serves both, so use same origin.
const WS_PORT = import.meta.env.VITE_WS_PORT || '1234';
export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? `ws://${location.hostname}:${WS_PORT}`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// A random identity for this tab: a friendly name + a cursor color.
export function makeLocalUser() {
  const c = pick(USER_COLORS);
  return {
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: c.color,
    colorLight: c.light,
  };
}
