/**
 * Tracks how many peers are connected to each room and enforces the per-room
 * cap. The y-websocket layer keeps its own per-doc connection set, but we keep
 * an explicit count so the cap decision is made *before* a socket is wired into
 * the CRDT document.
 */
export class RoomManager {
  private readonly counts = new Map<string, number>();

  constructor(private readonly maxPerRoom: number) {}

  canJoin(room: string): boolean {
    return (this.counts.get(room) ?? 0) < this.maxPerRoom;
  }

  /** Register a new connection; returns the new count for the room. */
  add(room: string): number {
    const next = (this.counts.get(room) ?? 0) + 1;
    this.counts.set(room, next);
    return next;
  }

  /** Drop a connection; returns the remaining count for the room. */
  remove(room: string): number {
    const next = (this.counts.get(room) ?? 1) - 1;
    if (next <= 0) {
      this.counts.delete(room);
      return 0;
    }
    this.counts.set(room, next);
    return next;
  }

  count(room: string): number {
    return this.counts.get(room) ?? 0;
  }

  get totalRooms(): number {
    return this.counts.size;
  }

  get totalConnections(): number {
    let total = 0;
    for (const c of this.counts.values()) total += c;
    return total;
  }
}
