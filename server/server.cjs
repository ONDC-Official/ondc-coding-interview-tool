/**
 * Live Coder backend.
 *
 *  - Runs the official y-websocket server (CRDT sync) over a `ws` server.
 *  - Enforces a hard cap of 2 connections per room, server-side.
 *  - Serves the built frontend (./dist) and SPA-routes /s/:roomId.
 *
 * One process handles both HTTP and WebSocket upgrades on the same port.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { WebSocketServer } = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = Number(process.env.PORT) || 1234;
const MAX_PER_ROOM = 2;
const ROOM_FULL_CODE = 4001; // app-specific close code the client looks for
const DIST = path.join(__dirname, '..', 'dist');

// ---------- HTTP: serve the built frontend ----------
const app = express();
app.use(express.static(DIST));

// SPA fallback: any non-asset GET returns index.html so /s/:roomId works on
// reload. (No-op in dev, where Vite serves the UI on :5173.)
app.use((req, res) => {
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res
      .status(404)
      .send('Frontend not built. Run `npm run build`, or use the Vite dev server.');
  }
});

const server = http.createServer(app);

// ---------- WebSocket: y-websocket sync + 2-user cap ----------
const wss = new WebSocketServer({ noServer: true });

// roomName -> current connection count.
const roomCounts = new Map();

function roomFromUrl(url) {
  // y-websocket connects to `${WS_URL}/${roomName}`, so the room is the path.
  return decodeURIComponent((url || '/').slice(1).split('?')[0]) || 'default';
}

wss.on('connection', (ws, req) => {
  const room = roomFromUrl(req.url);
  const count = roomCounts.get(room) || 0;

  if (count >= MAX_PER_ROOM) {
    // Reject the third+ peer: never wire it into the CRDT document.
    ws.close(ROOM_FULL_CODE, 'Session is full');
    return;
  }

  roomCounts.set(room, count + 1);
  ws.once('close', () => {
    const remaining = (roomCounts.get(room) || 1) - 1;
    if (remaining <= 0) roomCounts.delete(room);
    else roomCounts.set(room, remaining);
  });

  setupWSConnection(ws, req, { docName: room });
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

server.listen(PORT, () => {
  console.log(`Live Coder server listening on http://localhost:${PORT}`);
});
