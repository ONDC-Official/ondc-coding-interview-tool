import path from 'path';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid value for ${name}: "${raw}" (expected a positive number)`);
  }
  return n;
}

/** Resolved, validated runtime configuration. */
export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** Single port serving both HTTP (static client) and the WebSocket upgrade. */
  port: envInt('PORT', 1234),
  host: process.env.HOST ?? '0.0.0.0',
  /** Hard cap of concurrent peers per room, enforced server-side. */
  maxUsersPerRoom: envInt('MAX_USERS_PER_ROOM', 2),
  /**
   * Path to the built client. Defaults to ../../client/dist relative to the
   * compiled server (server/dist/ -> repo/client/dist). Override with CLIENT_DIST.
   */
  clientDist: process.env.CLIENT_DIST
    ? path.resolve(process.env.CLIENT_DIST)
    : path.resolve(__dirname, '..', '..', 'client', 'dist'),
} as const;

export const isProd = config.nodeEnv === 'production';
