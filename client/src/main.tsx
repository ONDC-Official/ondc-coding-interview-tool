import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import Session from './Session';
import './styles.css';

// NOTE: StrictMode is intentionally omitted. Its dev-only double-mounting would
// open/close two WebSocket connections per tab, briefly filling the 2-user cap
// during local testing. The session effect already cleans up after itself.
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/s/:roomId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
