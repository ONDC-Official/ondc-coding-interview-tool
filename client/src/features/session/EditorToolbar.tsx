import type { ChangeEvent } from 'react';
import { Brand } from '../../components/Brand';
import { ThemeToggle } from '../../components/ThemeToggle';
import type { Theme } from '../../lib/theme';
import { formatClock } from '../../lib/format';
import { LANGUAGES, type LanguageId } from './editor.config';
import type { Participant } from './useCollabSession';

interface Props {
  roomId: string;
  language: LanguageId;
  onLanguageChange: (value: LanguageId) => void;
  elapsedMs: number | null;
  peers: number;
  participants: Participant[];
  max: number;
  ready: boolean;
  copied: boolean;
  onCopyLink: () => void;
  isAdmin: boolean;
  onEnd: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function EditorToolbar({
  roomId,
  language,
  onLanguageChange,
  elapsedMs,
  peers,
  participants,
  max,
  ready,
  copied,
  onCopyLink,
  isAdmin,
  onEnd,
  theme,
  onToggleTheme,
}: Props) {
  const handleLang = (e: ChangeEvent<HTMLSelectElement>) =>
    onLanguageChange(e.target.value as LanguageId);

  return (
    <header className="editor-bar">
      <Brand size={22} />
      <span className="bar-divider" />

      <span className="room-tag">
        /s/<span className="accent">{roomId}</span>
      </span>
      <span className="bar-divider" />

      <label className="lang-select">
        <span className="sr-only">Language</span>
        <select value={language} onChange={handleLang} aria-label="Language">
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <div className="editor-bar-spacer" />

      <span className="timer" title="Session time">
        ⏱ {elapsedMs == null ? '--:--' : formatClock(elapsedMs)}
      </span>

      <span className="presence-pill" tabIndex={0}>
        <span className="presence-dots">
          {Array.from({ length: max }, (_, i) => (
            <span
              key={i}
              style={{ background: participants[i]?.color ?? 'var(--faint)' }}
            />
          ))}
        </span>
        <span className={`presence ${ready ? 'ok' : ''}`}>
          {peers}/{max} connected
        </span>
        <div className="presence-popover" role="tooltip">
          <div className="presence-popover-title">Connected</div>
          {participants.length === 0 ? (
            <div className="presence-empty">No one connected</div>
          ) : (
            participants.map((p, i) => (
              <div className="presence-person" key={i}>
                <span className="presence-person-dot" style={{ background: p.color }} />
                {p.name}
              </div>
            ))
          )}
        </div>
      </span>

      <button className="btn btn-primary btn-bar" onClick={onCopyLink}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>

      {isAdmin && (
        <button className="btn btn-danger btn-bar" onClick={onEnd}>
          End
        </button>
      )}

      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
