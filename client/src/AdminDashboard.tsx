import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './theme';
import {
  clearToken,
  createSession,
  endSession,
  getToken,
  listSessions,
  UnauthorizedError,
  type SessionRow,
} from './api';

const POLL_MS = 5000;

// Path to a session, honoring the deployment sub-path (Vite base, e.g.
// "/live-coder/"). Used for both the in-app link and the shareable URL.
function sessionPath(roomId: string): string {
  return `${import.meta.env.BASE_URL}s/${roomId}`;
}
function sessionUrl(roomId: string): string {
  return `${window.location.origin}${sessionPath(roomId)}`;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const bounceToLogin = useCallback(() => {
    clearToken();
    navigate('/login', { replace: true });
  }, [navigate]);

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
      setError('');
    } catch (e) {
      if (e instanceof UnauthorizedError) bounceToLogin();
      else setError('Could not load sessions.');
    }
  }, [bounceToLogin]);

  // Guard + initial load + polling.
  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true });
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [navigate, refresh]);

  const onCreate = async () => {
    setCreating(true);
    try {
      await createSession();
      await refresh();
    } catch (e) {
      if (e instanceof UnauthorizedError) bounceToLogin();
      else setError('Could not create session.');
    } finally {
      setCreating(false);
    }
  };

  const onEnd = async (roomId: string) => {
    try {
      await endSession(roomId);
      await refresh();
    } catch (e) {
      if (e instanceof UnauthorizedError) bounceToLogin();
      else setError('Could not end session.');
    }
  };

  const onCopy = async (roomId: string) => {
    const url = sessionUrl(roomId);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(roomId);
    setTimeout(() => setCopied((c) => (c === roomId ? null : c)), 1500);
  };

  return (
    <div className="admin">
      <header className="topbar">
        <div className="topbar-left">
          <Brand size={30} />
          <span className="admin-title">Admin</span>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={onCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create new session'}
          </button>
          <button className="btn btn-ghost" onClick={bounceToLogin}>
            Log out
          </button>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="admin-main">
        {error && <p className="form-error">{error}</p>}
        {sessions.length === 0 ? (
          <p className="hint">No active sessions. Click “Create new session” to start one.</p>
        ) : (
          <table className="session-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Created</th>
                <th>Connected</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.roomId}>
                  <td className="mono">{s.roomId}</td>
                  <td>{new Date(s.createdAt).toLocaleTimeString()}</td>
                  <td>
                    <span className={`presence ${s.connections > 0 ? 'ok' : 'bad'}`}>
                      <span className="dot" />
                      {s.connections}/{s.max}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-ghost" onClick={() => onCopy(s.roomId)}>
                      {copied === s.roomId ? 'Copied!' : 'Copy link'}
                    </button>
                    <a className="btn btn-ghost" href={sessionPath(s.roomId)} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <button className="btn btn-danger" onClick={() => onEnd(s.roomId)}>
                      End
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
