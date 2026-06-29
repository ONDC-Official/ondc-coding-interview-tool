import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config';

// In-memory bearer tokens -> expiry epoch ms. Lost on restart (like the CRDT
// docs), which simply forces the admin to log in again.
const tokens = new Map<string, number>();

/** Mint a fresh admin token valid for config.tokenTtlMs. */
export function issueToken(): string {
  const token = crypto.randomBytes(24).toString('base64url');
  tokens.set(token, Date.now() + config.tokenTtlMs);
  return token;
}

/** True if the token exists and has not expired (expired ones are pruned). */
export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const expiry = tokens.get(token);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    tokens.delete(token);
    return false;
  }
  return true;
}

/** Validate admin username/password against the configured credentials. */
export function checkCredentials(username: unknown, password: unknown): boolean {
  return username === config.adminUsername && password === config.adminPassword;
}

/** Express middleware: 401 unless a valid "Authorization: Bearer <token>" is present. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
