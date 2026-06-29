import { Router } from 'express';
import { config } from '../config';
import { checkCredentials, issueToken, requireAdmin } from '../auth';
import type { RoomManager } from '../ws/roomManager';
import type { SessionStore } from '../ws/sessionStore';

/**
 * Admin auth + session management API. Session creation is admin-only; the
 * resulting `/s/<roomId>` link is shared with a candidate who needs no login.
 */
export function createSessionRouter(rooms: RoomManager, store: SessionStore): Router {
  const router = Router();

  // Exchange admin credentials for a bearer token.
  router.post('/api/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (!checkCredentials(username, password)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    res.json({ token: issueToken() });
  });

  // Create a new admin-owned session.
  router.post('/api/sessions', requireAdmin, (_req, res) => {
    const { roomId, createdAt } = store.create();
    res.status(201).json({ roomId, createdAt, connections: 0, max: config.maxUsersPerRoom });
  });

  // List active sessions with live connection counts for the dashboard.
  router.get('/api/sessions', requireAdmin, (_req, res) => {
    const sessions = store
      .list()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        roomId: s.roomId,
        createdAt: s.createdAt,
        connections: rooms.count(s.roomId),
        max: config.maxUsersPerRoom,
      }));
    res.json({ sessions });
  });

  // End a session (blocks future WS joins; live peers stay until they leave).
  router.delete('/api/sessions/:roomId', requireAdmin, (req, res) => {
    const existed = store.remove(req.params.roomId);
    res.status(existed ? 200 : 404).json({ ok: existed });
  });

  return router;
}
