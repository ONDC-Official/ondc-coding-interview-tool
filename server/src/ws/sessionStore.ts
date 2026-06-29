import crypto from 'crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Mint a 16-char base62 id (~95 bits of entropy), mirroring the old client id. */
function newRoomId(): string {
  const bytes = crypto.randomBytes(16);
  let id = '';
  for (let i = 0; i < 16; i++) id += ALPHABET[bytes[i] % ALPHABET.length];
  return id;
}

export interface SessionInfo {
  roomId: string;
  createdAt: number;
}

/**
 * Registry of admin-created sessions. A room is only joinable over WebSocket if
 * it exists here. Kept separate from RoomManager's live connection counts so a
 * session stays valid while 0 peers are connected. In-memory (lost on restart).
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionInfo>();

  /** Create and register a new session; returns its room id. */
  create(): SessionInfo {
    const roomId = newRoomId();
    const info: SessionInfo = { roomId, createdAt: Date.now() };
    this.sessions.set(roomId, info);
    return info;
  }

  has(roomId: string): boolean {
    return this.sessions.has(roomId);
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()];
  }

  /** Remove a session; returns true if it existed. Future joins are rejected. */
  remove(roomId: string): boolean {
    return this.sessions.delete(roomId);
  }
}
