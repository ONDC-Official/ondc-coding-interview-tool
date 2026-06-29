import 'dotenv/config';
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

const isProdEnv = (process.env.NODE_ENV ?? 'development') === 'production';

// Reads a secret from the environment. In production it is REQUIRED — the
// server refuses to boot rather than fall back to a hardcoded value (which, in
// a public repo / image, is no secret at all). In development a convenience
// fallback is allowed so `npm run dev` works without a .env.
function envSecret(name: string, devFallback: string): string {
  const raw = process.env[name];
  if (raw !== undefined && raw !== '') return raw;
  if (isProdEnv) {
    throw new Error(
      `${name} is not set. It is required in production and must be supplied ` +
        `via an environment variable / secret (never hardcoded).`
    );
  }
  return devFallback;
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
   * Admin credentials gating session creation. The username has a harmless
   * default; the password is a secret — required in production, dev-only
   * fallback otherwise (see envSecret). Set both via env / .env / CI secret.
   */
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: envSecret('ADMIN_PASSWORD', 'dev-only-password'),
  /** Admin login token lifetime (in-memory). Default 12h. */
  tokenTtlMs: envInt('ADMIN_TOKEN_TTL_MIN', 720) * 60_000,
  /**
   * Path to the built client. Defaults to ../../client/dist relative to the
   * compiled server (server/dist/ -> repo/client/dist). Override with CLIENT_DIST.
   */
  clientDist: process.env.CLIENT_DIST
    ? path.resolve(process.env.CLIENT_DIST)
    : path.resolve(__dirname, '..', '..', 'client', 'dist'),
} as const;

export const isProd = config.nodeEnv === 'production';
