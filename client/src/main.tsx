import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import Session from './Session';
import { applyTheme, getInitialTheme } from './theme';
import './styles.css';

// Apply the stored / system theme before the first paint so there is no flash
// of the wrong palette while React mounts.
applyTheme(getInitialTheme());

// NOTE: StrictMode is intentionally omitted. Its dev-only double-mounting would
// open/close two WebSocket connections per tab, briefly filling the 2-user cap
// during local testing. The session effect already cleans up after itself.
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Strip the trailing slash from the Vite base ("/live-coder/" -> "/live-coder",
// "/" -> "") so React Router resolves routes under the deployment sub-path.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(rootEl).render(
  <BrowserRouter basename={basename}>
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/s/:roomId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
