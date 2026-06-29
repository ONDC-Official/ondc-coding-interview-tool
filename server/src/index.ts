import http from 'http';
import { config } from './config';
import { logger } from './logger';
import { createApp } from './app';
import { attachCollab } from './ws/collab';
import { RoomManager } from './ws/roomManager';
import { SessionStore } from './ws/sessionStore';

function main(): void {
  const server = http.createServer();

  // Shared state: live per-room connection counts + the admin-created session
  // registry. Both are used by the WS layer and the HTTP API.
  const rooms = new RoomManager(config.maxUsersPerRoom);
  const store = new SessionStore();

  // WebSocket collaborative sync + per-room cap (adds the 'upgrade' handler).
  attachCollab(server, rooms, store);

  // HTTP app (static client + health + admin/session API). Attach as 'request'.
  const app = createApp(rooms, store);
  server.on('request', app);

  server.listen(config.port, config.host, () => {
    logger.info(
      `ONDC Coding Interview server listening on http://${config.host}:${config.port} ` +
        `(env=${config.nodeEnv}, cap=${config.maxUsersPerRoom}/room)`
    );
  });

  // Graceful shutdown.
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal} — shutting down...`);
    server.close(() => {
      logger.info('Server closed. Bye.');
      process.exit(0);
    });
    // Force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}

main();
