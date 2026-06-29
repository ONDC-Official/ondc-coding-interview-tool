import type { SessionRow } from '../../../lib/api';
import { formatClock } from '../../../lib/format';
import { sessionPath } from '../useSessions';
import { sessionState, stateMeta } from '../status';

interface Props {
  sessions: SessionRow[];
  now: number;
  copied: string | null;
  onCopy: (roomId: string) => void;
  onEnd: (roomId: string) => void;
}

export function SessionsTable({ sessions, now, copied, onCopy, onEnd }: Props) {
  return (
    <div className="sessions">
      <div className="sessions-row sessions-head">
        <span>Room</span>
        <span>Status</span>
        <span>Users</span>
        <span>Duration</span>
        <span className="text-right">Actions</span>
      </div>

      {sessions.length === 0 ? (
        <div className="admin-empty">
          No active sessions. Click “New session” to start one.
        </div>
      ) : (
        sessions.map((s) => {
          const state = sessionState(s.connections, s.max);
          const meta = stateMeta(state);
          return (
            <div className="sessions-row" key={s.roomId}>
              <span className="col-room">
                /s/<span className="accent">{s.roomId}</span>
              </span>
              <span className="status-pill" style={{ color: meta.color }}>
                <span className="dot" />
                {meta.label}
              </span>
              <span className="col-users" style={{ color: meta.color }}>
                {s.connections}/{s.max}
              </span>
              <span className="col-dur">{formatClock(now - s.createdAt)}</span>
              <span className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onCopy(s.roomId)}>
                  {copied === s.roomId ? 'Copied!' : 'Copy'}
                </button>
                <a
                  className="btn btn-ghost btn-sm"
                  href={sessionPath(s.roomId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
                <button className="btn btn-danger btn-sm" onClick={() => onEnd(s.roomId)}>
                  End
                </button>
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
