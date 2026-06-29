import path from 'path';
import fs from 'fs';
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config, isProd } from './config';
import { logger } from './logger';
import { createHealthRouter } from './routes/health';
import type { RoomManager } from './ws/roomManager';

/** Builds the Express application (HTTP side: middleware, health, static client). */
export function createApp(rooms: RoomManager): Express {
  const app = express();
  app.disable('x-powered-by');

  // Security headers. CSP is disabled because the built SPA + CodeMirror rely on
  // inline styles/workers that a strict default policy would block; the other
  // helmet protections remain active.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(morgan(isProd ? 'combined' : 'dev'));

  app.use('/', createHealthRouter(rooms));

  // Serve the built client in production. In dev the client is served by Vite
  // on :5173, so this is a no-op (the build simply won't exist).
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.clientDist));
    // SPA fallback so deep links like /s/:roomId work on reload.
    app.get(/.*/, (_req: Request, res: Response) => res.sendFile(indexHtml));
  } else {
    logger.warn(
      `Client build not found at ${config.clientDist}. ` +
        `Run "npm run build" in client/ for production, or use the Vite dev server.`
    );
    app.get(/.*/, (_req: Request, res: Response) =>
      res
        .status(404)
        .send('Frontend not built. Build client/, or use the Vite dev server in development.')
    );
  }

  // Centralized error handler (must have 4 args to be recognized by Express).
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled request error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
