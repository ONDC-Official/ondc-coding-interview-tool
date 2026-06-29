// Collaboration transport + local identity. Split out of the editor module so
// the WebSocket URL derivation and the per-tab user identity live in one place,
// independent of Monaco/editor concerns.

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

// Identity for this tab: a cursor color plus a name. The candidate join gate
// passes the display name the candidate typed; the admin opener (and any caller
// without a name) falls back to a friendly random handle.
export function makeLocalUser(name?: string): LocalUser {
  const c = pick(USER_COLORS);
  const trimmed = name?.trim();
  return {
    name: trimmed && trimmed.length > 0 ? trimmed : `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: c.color,
    colorLight: c.light,
  };
}
