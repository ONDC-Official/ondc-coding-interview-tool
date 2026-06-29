import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './features/auth/LoginPage';
import AdminDashboardPage from './features/admin/AdminDashboardPage';
import SessionPage from './features/session/SessionPage';

// Route table. Admin is the default landing; the guard inside the dashboard
// bounces to /login when there is no token.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/s/:roomId" element={<SessionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
