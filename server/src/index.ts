import http from 'http';
import { config } from './config';
import { logger } from './logger';
import { createApp } from './app';
import { attachCollab } from './ws/collab';

function main(): void {
  const server = http.createServer();

  // WebSocket collaborative sync + per-room cap (adds the 'upgrade' handler).
  const rooms = attachCollab(server);

  // HTTP app (static client + health). Attach as the 'request' handler.
  const app = createApp(rooms);
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
