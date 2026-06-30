import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { config } from '../config';
import { logger } from '../logger';
import type { RoomManager } from './roomManager';
import type { SessionStore } from './sessionStore';

/** App-specific WebSocket close code: room already has the max number of peers. */
export const ROOM_FULL_CODE = 4001;
/** App-specific WebSocket close code: room was not created by an admin (or ended). */
export const ROOM_NOT_FOUND_CODE = 4004;

// y-websocket ships its server helpers as an untyped deep CommonJS export
// (only reachable via the package "exports" map as `y-websocket/bin/utils`).
const { setupWSConnection } = require('y-websocket/bin/utils') as {
  setupWSConnection: (
    conn: WebSocket,
    req: IncomingMessage,
    opts?: { docName?: string; gc?: boolean }
  ) => void;
};

// Garbage collection is disabled on the shared doc: this editor drives undo via
// a client-side Y.UndoManager, and gc can drop the deleted-content history the
// undo stack relies on. Keeping deleted items also removes a class of subtle
// merge edge cases during the rapid backspace-and-retype the interview surface
// sees. Cost is bounded — a single interview doc, in-memory, lost on restart.
const DOC_GC = false;

/** The room name is the WebSocket URL path (y-websocket connects to WS_URL/<room>). */
function roomFromUrl(url: string | undefined): string {
  const pathname = (url ?? '/').slice(1).split('?')[0];
  return decodeURIComponent(pathname) || 'default';
}

/**
 * Wires Yjs collaborative sync onto an existing HTTP server. Rejects rooms that
 * weren't created by an admin and enforces the per-room user cap. The
 * RoomManager and SessionStore are owned by the caller (index.ts) so the HTTP
 * API can share them.
 */
export function attachCollab(
  server: HttpServer,
  rooms: RoomManager,
  store: SessionStore
): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const room = roomFromUrl(req.url);

    // Only admin-created (and not-yet-ended) sessions are joinable.
    if (!store.has(room)) {
      logger.warn(`Rejected peer for unknown room "${room}"`);
      ws.close(ROOM_NOT_FOUND_CODE, 'Session not found');
      return;
    }

    // Enforce the cap BEFORE binding the socket to the CRDT document.
    if (!rooms.canJoin(room)) {
      logger.warn(`Rejected peer for full room "${room}" (cap ${config.maxUsersPerRoom})`);
      ws.close(ROOM_FULL_CODE, 'Session is full');
      return;
    }

    const count = rooms.add(room, ws);
    logger.info(`Peer joined room "${room}" (${count}/${config.maxUsersPerRoom})`);

    ws.once('close', () => {
      const remaining = rooms.remove(room, ws);
      logger.info(`Peer left room "${room}" (${remaining}/${config.maxUsersPerRoom})`);
    });

    setupWSConnection(ws, req, { docName: room, gc: DOC_GC });
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });
}
