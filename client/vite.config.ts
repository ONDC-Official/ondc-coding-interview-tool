import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal declaration so this Node-run config typechecks without @types/node.
declare const process: { env: Record<string, string | undefined> };

// Dev: this server runs on :5173, the Express/y-websocket backend on :1234
// (the WS URL is auto-derived from the page host; see src/editor.ts).
// Prod: `npm run build` emits ./dist, which the Express server serves on :1234.
//
// VITE_BASE_PATH lets the app be served under a sub-path behind a reverse proxy
// (e.g. nginx at "/live-coder/"). It must start and end with "/". Default "/"
// keeps local dev and root deployments unchanged. The proxy strips the prefix,
// so the server itself always serves at root; only the browser-facing URLs
// (assets, /api, the WS path) carry the prefix.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // bind 0.0.0.0 so LAN/remote devices can connect
    // Dev only: the backend runs on its own port (:1234), but the client's HTTP
    // API calls are relative (so they work same-origin in prod). Proxy /api to
    // the backend so login / session calls reach it from the :5173 dev origin.
    // (The WS connects to :1234 directly — see src/editor.ts — so it needs no
    // proxy here.)
    proxy: {
      '/api': { target: 'http://localhost:1234', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
