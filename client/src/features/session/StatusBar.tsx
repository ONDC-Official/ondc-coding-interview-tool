import { languageLabel } from './editor.config';
import type { CursorPos } from './useCollabSession';

interface Props {
  language: string;
  cursor: CursorPos;
  ready: boolean;
}

// Bottom editor status bar. Shows real state only — language, indentation,
// cursor position, and the live CRDT sync indicator (no fake latency).
export function StatusBar({ language, cursor, ready }: Props) {
  return (
    <footer className="statusbar">
      <span className="accent">{languageLabel(language)}</span>
      <span>spaces: 4</span>
      <span>
        Ln {cursor.line}, Col {cursor.column}
      </span>
      <span className="statusbar-spacer" />
      {ready ? (
        <span className="sb-synced">
          <span className="dot" />
          Synced · CRDT
        </span>
      ) : (
        <span className="sb-syncing">Syncing…</span>
      )}
      <span>Yjs</span>
    </footer>
  );
}
