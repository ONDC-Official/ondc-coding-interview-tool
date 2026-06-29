import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './Landing.jsx';
import Session from './Session.jsx';
import './styles.css';

// NOTE: StrictMode is intentionally omitted. Its dev-only double-mounting would
// open/close two WebSocket connections per tab, briefly filling the 2-user cap
// during local testing. The session effect already cleans up after itself.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/s/:roomId" element={<Session />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
