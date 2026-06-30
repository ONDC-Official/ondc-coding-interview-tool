import type { WebSocket } from 'ws';

/**
 * Tracks the live peers connected to each room and enforces the per-room cap.
 *
 * We hold the actual sockets (not just a counter) so the cap decision can first
 * **prune sockets that are already closing/closed**. That matters on reconnects:
 * y-websocket opens a fresh socket when a peer's connection drops, and the old
 * socket's `close` event can land *after* the new socket's upgrade. A plain
 * counter would still read "2/2" in that window and falsely reject the returning
 * peer as ROOM_FULL, permanently kicking them. Pruning dead sockets frees the
 * stale slot so the reconnect succeeds, while a genuine 3rd live peer is still
 * rejected.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Set<WebSocket>>();

  constructor(private readonly maxPerRoom: number) {}

  /** Drop sockets that are no longer OPEN (CLOSING=2 / CLOSED=3). */
  private prune(set: Set<WebSocket>): void {
    for (const ws of set) {
      if (ws.readyState === ws.CLOSING || ws.readyState === ws.CLOSED) {
        set.delete(ws);
      }
    }
  }

  private liveSet(room: string): Set<WebSocket> | undefined {
    const set = this.rooms.get(room);
    if (set) this.prune(set);
    return set;
  }

  canJoin(room: string): boolean {
    const set = this.liveSet(room);
    return (set?.size ?? 0) < this.maxPerRoom;
  }

  /** Register a new connection; returns the new live count for the room. */
  add(room: string, ws: WebSocket): number {
    let set = this.rooms.get(room);
    if (!set) {
      set = new Set();
      this.rooms.set(room, set);
    }
    this.prune(set);
    set.add(ws);
    return set.size;
  }

  /** Drop a connection; returns the remaining live count for the room. */
  remove(room: string, ws: WebSocket): number {
    const set = this.rooms.get(room);
    if (!set) return 0;
    set.delete(ws);
    if (set.size === 0) {
      this.rooms.delete(room);
      return 0;
    }
    return set.size;
  }

  count(room: string): number {
    return this.liveSet(room)?.size ?? 0;
  }

  get totalRooms(): number {
    return this.rooms.size;
  }

  get totalConnections(): number {
    let total = 0;
    for (const set of this.rooms.values()) {
      this.prune(set);
      total += set.size;
    }
    return total;
  }
}
