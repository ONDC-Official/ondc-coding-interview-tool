import { Router } from 'express';
import type { RoomManager } from '../ws/roomManager';

/** Health/status endpoints. Useful for load balancers and quick smoke checks. */
export function createHealthRouter(rooms: RoomManager): Router {
  const router = Router();
  const startedAt = Date.now();

  router.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      rooms: rooms.totalRooms,
      connections: rooms.totalConnections,
    });
  });

  return router;
}
