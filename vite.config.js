import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: this server runs on :5173, the y-websocket backend on :1234 (see .env.development).
// Prod: `npm run build` emits ./dist, which server/server.cjs serves on :1234.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true }, // host:true -> bind 0.0.0.0 so LAN devices can connect
  build: { outDir: 'dist' },
});
