import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './theme';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import * as monaco from 'monaco-editor';
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  monacoLanguage,
  monacoTheme,
  EDITOR_OPTIONS,
  makeLocalUser,
  WS_URL,
  type LanguageId,
} from './editor';

// Server close code used to signal "room already has 2 people".
const ROOM_FULL_CODE = 4001;
// Server close code: room was never created by an admin, or has been ended.
const ROOM_NOT_FOUND_CODE = 4004;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export default function Session() {
  const { roomId } = useParams<{ roomId: string }>();
  const { theme, toggle } = useTheme();
  const editorParent = useRef<HTMLDivElement>(null);
  const ymetaRef = useRef<Y.Map<string> | null>(null);

  // Latest theme, read by the build effect (which is keyed on roomId only).
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const [language, setLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  // True once the initial document state has been received from the server.
  // Editing is blocked until then (see the build effect) so we never type into
  // an un-synced doc and have the bulk sync later remap the cursor / merge text.
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);
  const [full, setFull] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId || !editorParent.current) return;

    const ydoc = new Y.Doc();
    // Yjs text key kept as 'codemirror' (the prior editor's key) so rooms whose
    // contents the server already persisted under it survive this editor swap.
    const ytext = ydoc.getText('codemirror');
    const ymeta = ydoc.getMap<string>('meta');
    ymetaRef.current = ymeta;

    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);
    const awareness = provider.awareness;
    awareness.setLocalStateField('user', makeLocalUser());

    // Build the Monaco editor. It starts read-only and is flipped to editable
    // once the provider reports its first sync (see onSync), so local edits can
    // never race the incoming document state.
    const initialLang = (ymeta.get('language') as LanguageId) || DEFAULT_LANGUAGE;
    const model = monaco.editor.createModel('', monacoLanguage(initialLang));
    model.updateOptions({ tabSize: 4, insertSpaces: true });

    const editor = monaco.editor.create(editorParent.current, {
      ...EDITOR_OPTIONS,
      model,
      theme: monacoTheme(themeRef.current),
      readOnly: true,
    });

    // Bind the Monaco model to the shared Yjs text + awareness. This drives both
    // collaborative text sync AND rendering of the remote peer's cursor/selection.
    const binding = new MonacoBinding(ytext, model, new Set([editor]), awareness);

    // Undo/redo is driven by a Yjs UndoManager scoped to THIS binding's edits,
    // not Monaco's native model history. The binding applies the remote peer's
    // edits to the model as ordinary changes, so Monaco's own undo would let
    // Cmd-Z revert their work; tracking only the binding's origin keeps undo
    // local. We rebind the undo/redo chords to route through it.
    const undoManager = new Y.UndoManager(ytext, {
      trackedOrigins: new Set([binding]),
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () =>
      undoManager.undo()
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
      () => undoManager.redo()
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () =>
      undoManager.redo()
    );

    // Language lives in the shared doc, so a change by either peer (or the
    // already-synced state seen by a late joiner) updates both editors.
    const applyLanguage = () => {
      const lang = (ymeta.get('language') as LanguageId) || DEFAULT_LANGUAGE;
      setLanguage(lang);
      monaco.editor.setModelLanguage(model, monacoLanguage(lang));
    };
    ymeta.observe(applyLanguage);
    applyLanguage();

    // Presence: awareness states = number of connected peers (incl. self).
    const updatePeers = () => setPeers(awareness.getStates().size);
    awareness.on('change', updatePeers);
    updatePeers();

    const onStatus = (e: { status: ConnectionStatus }) => setStatus(e.status);
    provider.on('status', onStatus);

    // Editing is enabled only while synced. This blocks input before the first
    // sync (so we don't merge our text into the doc the server is about to
    // send) and pauses it during a reconnect re-sync, then restores focus.
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
      editor.updateOptions({ readOnly: !isSynced });
      if (isSynced) editor.focus();
    };
    provider.on('sync', onSync);
    if (provider.synced) onSync(true);

    // The server closes with a custom code to reject a connection: ROOM_FULL_CODE
    // for a 3rd peer, ROOM_NOT_FOUND_CODE for a room no admin created. In both
    // cases stop auto-reconnect and show the matching screen.
    const onClose = (event: CloseEvent) => {
      if (!event) return;
      if (event.code === ROOM_FULL_CODE || event.code === ROOM_NOT_FOUND_CODE) {
        if (event.code === ROOM_FULL_CODE) setFull(true);
        else setNotFound(true);
        provider.shouldConnect = false;
        provider.disconnect();
      }
    };
    provider.on('connection-close', onClose);

    return () => {
      ymeta.unobserve(applyLanguage);
      awareness.off('change', updatePeers);
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      provider.off('connection-close', onClose);
      undoManager.destroy();
      binding.destroy();
      editor.dispose();
      model.dispose();
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId]);

  // Swap Monaco's theme when the app theme toggles. setTheme is global (one
  // editor here) and never rebuilds the editor, so the collab connection holds.
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme(theme));
  }, [theme]);

  const onLanguageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    // Write to the shared doc; the observer above updates both editors.
    ymetaRef.current?.set('language', e.target.value);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Fallback for non-secure contexts.
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (notFound) {
    return (
      <div className="landing">
        <ThemeToggle theme={theme} onToggle={toggle} floating />
        <div className="landing-card">
          <div className="landing-brand">
            <Brand size={56} stacked />
          </div>
          <h2 className="full-title">Session not found</h2>
          <p className="tagline">
            This link is invalid or the session has ended. Ask the interviewer
            for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  if (full) {
    return (
      <div className="landing">
        <ThemeToggle theme={theme} onToggle={toggle} floating />
        <div className="landing-card">
          <div className="landing-brand">
            <Brand size={56} stacked />
          </div>
          <h2 className="full-title">Session is full</h2>
          <p className="tagline">
            This room already has 2 people. Sessions are limited to two
            participants.
          </p>
        </div>
      </div>
    );
  }

  // Ready to edit only once connected AND the initial doc has synced.
  const connected = status === 'connected';
  const ready = connected && synced;
  const statusLabel = ready
    ? `${peers}/2 connected`
    : connected
      ? 'syncing…'
      : status;

  return (
    <div className="session">
      <header className="topbar">
        <div className="topbar-left">
          <Brand size={30} />
          <label className="lang-select">
            <span className="lang-label">Language</span>
            <select value={language} onChange={onLanguageChange}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="topbar-right">
          <span className={`presence ${ready ? 'ok' : 'bad'}`}>
            <span className="dot" />
            {statusLabel}
          </span>
          <button className="btn btn-ghost" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="editor-wrap" ref={editorParent} />
    </div>
  );
}
