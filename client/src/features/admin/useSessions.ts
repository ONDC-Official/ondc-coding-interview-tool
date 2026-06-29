import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearToken,
  createSession,
  endSession,
  getToken,
  listSessions,
  UnauthorizedError,
  type SessionRow,
} from '../../lib/api';

const POLL_MS = 5000;
// Re-render every second so the derived Duration column stays live between the
// (slower) server polls.
const TICK_MS = 1000;

// Path to a session, honoring the deployment sub-path (Vite base, e.g.
// "/live-coder/"). Used for both the in-app link and the shareable URL.
export function sessionPath(roomId: string): string {
  return `${import.meta.env.BASE_URL}s/${roomId}`;
}
export function sessionUrl(roomId: string): string {
  return `${window.location.origin}${sessionPath(roomId)}`;
}

export interface UseSessions {
  sessions: SessionRow[];
  error: string;
  creating: boolean;
  copied: string | null;
  now: number;
  create: () => Promise<void>;
  end: (roomId: string) => Promise<void>;
  copy: (roomId: string) => Promise<void>;
  logout: () => void;
}

// Owns the dashboard's session list: initial load, 5s polling, a 1s clock for
// live durations, and the create/end/copy actions. Bounces to /login on a 401.
export function useSessions(): UseSessions {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const logout = useCallback(() => {
    clearToken();
    navigate('/login', { replace: true });
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
      setError('');
    } catch (e) {
      if (e instanceof UnauthorizedError) logout();
      else setError('Could not load sessions.');
    }
  }, [logout]);

  // Guard + initial load + polling.
  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true });
      return;
    }
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [navigate, refresh]);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      await createSession();
      await refresh();
    } catch (e) {
      if (e instanceof UnauthorizedError) logout();
      else setError('Could not create session.');
    } finally {
      setCreating(false);
    }
  }, [refresh, logout]);

  const end = useCallback(
    async (roomId: string) => {
      try {
        await endSession(roomId);
        await refresh();
      } catch (e) {
        if (e instanceof UnauthorizedError) logout();
        else setError('Could not end session.');
      }
    },
    [refresh, logout]
  );

  const copy = useCallback(async (roomId: string) => {
    const url = sessionUrl(roomId);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for non-secure contexts.
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(roomId);
    setTimeout(() => setCopied((c) => (c === roomId ? null : c)), 1500);
  }, []);

  return { sessions, error, creating, copied, now, create, end, copy, logout };
}
