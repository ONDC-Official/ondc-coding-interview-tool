// Thin client for the admin/session API. The bearer token lives in
// sessionStorage so it clears when the tab closes.

const TOKEN_KEY = 'adminToken';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** Thrown on a 401 so callers can bounce the user back to /login. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export interface SessionRow {
  roomId: string;
  createdAt: number;
  connections: number;
  max: number;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError();
  }
  return res;
}

/** Exchange credentials for a token. Returns false on bad credentials. */
export async function login(username: string, password: string): Promise<boolean> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) return false;
  if (!res.ok) throw new Error('Login failed');
  const { token } = (await res.json()) as { token: string };
  setToken(token);
  return true;
}

export async function createSession(): Promise<SessionRow> {
  const res = await authFetch('/api/sessions', { method: 'POST' });
  if (!res.ok) throw new Error('Could not create session');
  return (await res.json()) as SessionRow;
}

export async function listSessions(): Promise<SessionRow[]> {
  const res = await authFetch('/api/sessions');
  if (!res.ok) throw new Error('Could not load sessions');
  const { sessions } = (await res.json()) as { sessions: SessionRow[] };
  return sessions;
}

export async function endSession(roomId: string): Promise<void> {
  const res = await authFetch(`/api/sessions/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) throw new Error('Could not end session');
}
