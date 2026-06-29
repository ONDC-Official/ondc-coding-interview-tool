import type { SessionRow } from '../../lib/api';

// A room's occupancy state, mirroring the mockup's Live / Waiting / Empty
// treatment: full = Live (green), partially filled = Waiting (amber), nobody
// connected = Empty (faint).
export type SessionState = 'live' | 'waiting' | 'empty';

export function sessionState(connections: number, max: number): SessionState {
  if (connections >= max) return 'live';
  if (connections > 0) return 'waiting';
  return 'empty';
}

interface StateMeta {
  label: string;
  // A CSS custom-property reference, applied inline as the row's accent color.
  color: string;
}

const STATE_META: Record<SessionState, StateMeta> = {
  live: { label: 'Live', color: 'var(--green)' },
  waiting: { label: 'Waiting', color: 'var(--amber)' },
  empty: { label: 'Empty', color: 'var(--faint)' },
};

export function stateMeta(state: SessionState): StateMeta {
  return STATE_META[state];
}

export interface SessionStats {
  live: number;
  waiting: number;
  users: number;
  total: number;
}

// Dashboard stat-strip aggregates, all derived from the active session list.
export function summarize(sessions: SessionRow[]): SessionStats {
  let live = 0;
  let waiting = 0;
  let users = 0;
  for (const s of sessions) {
    const state = sessionState(s.connections, s.max);
    if (state === 'live') live++;
    else if (state === 'waiting') waiting++;
    users += s.connections;
  }
  return { live, waiting, users, total: sessions.length };
}
