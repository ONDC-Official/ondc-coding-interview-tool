import { Brand } from '../../components/Brand';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useTheme } from '../../lib/theme';
import { useSessions } from './useSessions';
import { StatStrip } from './components/StatStrip';
import { SessionsTable } from './components/SessionsTable';

export default function AdminDashboardPage() {
  const { theme, toggle } = useTheme();
  const { sessions, error, creating, copied, now, create, end, copy, logout } =
    useSessions();

  return (
    <div className="screen">
      <header className="appbar">
        <Brand size={26} />
        <span className="badge">Admin</span>
        <div className="appbar-spacer" />
        <span className="appbar-user">
          <span className="avatar">A</span>
          admin
        </span>
        <button className="btn btn-ghost btn-bar" onClick={logout}>
          Log out
        </button>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <main className="admin-main">
        <div className="admin-head">
          <div>
            <h1>Sessions</h1>
            <p className="tagline">Live and waiting interview rooms.</p>
          </div>
          <button className="btn btn-primary" onClick={create} disabled={creating}>
            <span className="mono" style={{ fontSize: 17 }}>
              +
            </span>
            {creating ? 'Creating…' : 'New session'}
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}

        <StatStrip sessions={sessions} />
        <SessionsTable
          sessions={sessions}
          now={now}
          copied={copied}
          onCopy={copy}
          onEnd={end}
        />
      </main>
    </div>
  );
}
