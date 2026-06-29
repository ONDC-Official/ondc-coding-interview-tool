import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyTheme, getInitialTheme } from './lib/theme';
import './styles/index.css';

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
    <App />
  </BrowserRouter>
);
