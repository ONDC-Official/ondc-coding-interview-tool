import type { SessionRow } from '../../../lib/api';
import { summarize } from '../status';

// Four derived stat cards. Everything comes from the active session list — no
// extra server data — so "Total" replaces the mockup's (non-historical) "Today".
export function StatStrip({ sessions }: { sessions: SessionRow[] }) {
  const { live, waiting, users, total } = summarize(sessions);
  const cards = [
    { label: 'Live now', value: live, color: 'var(--green)' },
    { label: 'Waiting', value: waiting, color: 'var(--amber)' },
    { label: 'Connected users', value: users, color: 'var(--text)' },
    { label: 'Total', value: total, color: 'var(--text)' },
  ];

  return (
    <div className="stat-strip">
      {cards.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className="stat-value" style={{ color: c.color }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
