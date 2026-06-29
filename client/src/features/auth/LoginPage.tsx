import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useTheme } from '../../lib/theme';
import { login } from '../../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const ok = await login(username, password);
      if (ok) navigate('/admin', { replace: true });
      else setError('Invalid username or password.');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <ThemeToggle theme={theme} onToggle={toggle} floating />
      <div className="screen-center">
        <div className="auth-card">
          <div className="auth-hero">
            <Brand size={42} subtitle="ONDC · Interview Console" stacked />
          </div>

          <form className="panel auth-panel login-form" onSubmit={onSubmit}>
            <h1>Admin sign in</h1>
            <p className="tagline">Create and monitor live interview sessions.</p>

            <label className="field-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              className="text-input"
              type="text"
              placeholder="admin"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />

            <label className="field-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="text-input"
              type="password"
              placeholder="••••••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            {error && <p className="form-error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
