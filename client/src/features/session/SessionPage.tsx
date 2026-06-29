import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useTheme } from '../../lib/theme';
import { endSession, getToken } from '../../lib/api';
import { useCollabSession } from './useCollabSession';
import { EditorToolbar } from './EditorToolbar';
import { StatusBar } from './StatusBar';
import { JoinGate, type JoinMode } from './JoinGate';

// Room capacity, mirrored from the server's maxUsersPerRoom.
const MAX_PEERS = 2;

// Candidate display name persists across reloads so a returning candidate isn't
// re-prompted by the join gate.
const NAME_KEY = 'ondc-display-name';
function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage may be unavailable; the in-memory name still applies */
  }
}

export default function SessionPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  // The admin opener (holds a token) auto-joins; a candidate goes through the
  // join gate first and supplies a display name. A previously-entered name is
  // restored so a reload skips the gate.
  const isAdmin = !!getToken();
  const [displayName, setDisplayName] = useState(() => readStoredName());
  const [joined, setJoined] = useState(
    () => isAdmin || readStoredName().trim().length > 0
  );

  const onJoin = () => {
    storeName(displayName.trim());
    setJoined(true);
  };

  const collab = useCollabSession({
    roomId,
    displayName: isAdmin ? 'Interviewer' : displayName,
    theme,
    active: joined,
  });

  const onEnd = async () => {
    if (roomId) {
      try {
        await endSession(roomId);
      } catch {
        /* best-effort; navigate away regardless */
      }
    }
    navigate('/admin');
  };

  // Which gate card (if any) covers the editor.
  const overlayMode: JoinMode | null = !joined
    ? 'form'
    : collab.full
      ? 'full'
      : collab.notFound
        ? 'notfound'
        : !collab.ready
          ? 'connecting'
          : null;

  return (
    <div className="session-root">
      {joined && (
        <div className="session">
          <EditorToolbar
            roomId={roomId ?? ''}
            language={collab.language}
            onLanguageChange={collab.setLanguage}
            elapsedMs={collab.elapsedMs}
            peers={collab.peers}
            participants={collab.participants}
            max={MAX_PEERS}
            ready={collab.ready}
            copied={collab.copied}
            onCopyLink={collab.copyLink}
            isAdmin={isAdmin}
            onEnd={onEnd}
            theme={theme}
            onToggleTheme={toggle}
          />
          <main className="editor-wrap" ref={collab.editorParent} />
          <StatusBar language={collab.language} cursor={collab.cursor} ready={collab.ready} />
        </div>
      )}

      {overlayMode && (
        <div className="session-overlay">
          <ThemeToggle theme={theme} onToggle={toggle} floating />
          <JoinGate
            mode={overlayMode}
            roomId={roomId ?? ''}
            name={displayName}
            onName={setDisplayName}
            onJoin={onJoin}
          />
        </div>
      )}
    </div>
  );
}
