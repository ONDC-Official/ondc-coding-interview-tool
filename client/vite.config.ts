import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: this server runs on :5173, the Express/y-websocket backend on :1234
// (the WS URL is auto-derived from the page host; see src/editor.ts).
// Prod: `npm run build` emits ./dist, which the Express server serves on :1234.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true }, // host:true -> bind 0.0.0.0 so LAN/remote devices can connect
  build: { outDir: 'dist' },
});
