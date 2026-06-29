import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './theme';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  langExtension,
  editorSetup,
  editorTheme,
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
  const viewRef = useRef<EditorView | null>(null);

  // A CodeMirror compartment lets us hot-swap the editor theme on toggle
  // without rebuilding the editor (which would drop the collab connection).
  const themeConfRef = useRef<Compartment | null>(null);
  if (themeConfRef.current === null) themeConfRef.current = new Compartment();
  const themeConf = themeConfRef.current;
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
    const ytext = ydoc.getText('codemirror');
    const ymeta = ydoc.getMap<string>('meta');
    ymetaRef.current = ymeta;

    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);
    const awareness = provider.awareness;
    awareness.setLocalStateField('user', makeLocalUser());

    const languageConf = new Compartment();
    // Gate editability on the initial sync. Starts read-only; flipped to
    // editable once the provider reports it has synced (and back to read-only
    // during any reconnect re-sync) so local edits can never race the incoming
    // document state.
    const editableConf = new Compartment();

    const state = EditorState.create({
      doc: '',
      extensions: [
        editorSetup,
        // Undo/redo is driven by the Yjs UndoManager (created internally by
        // yCollab), not CodeMirror's native history — see editorSetup. This
        // keymap routes Cmd-Z / Cmd-Shift-Z / Cmd-Y to it so undo only ever
        // reverts THIS user's edits, never the remote peer's.
        keymap.of([...yUndoManagerKeymap, indentWithTab]),
        themeConf.of(editorTheme(themeRef.current)),
        EditorView.lineWrapping,
        languageConf.of(langExtension(ymeta.get('language') || DEFAULT_LANGUAGE)),
        editableConf.of(EditorView.editable.of(false)),
        yCollab(ytext, awareness),
      ],
    });

    const view = new EditorView({ state, parent: editorParent.current });
    viewRef.current = view;

    // Language lives in the shared doc, so a change by either peer (or the
    // already-synced state seen by a late joiner) updates both editors.
    const applyLanguage = () => {
      const lang = (ymeta.get('language') as LanguageId) || DEFAULT_LANGUAGE;
      setLanguage(lang);
      view.dispatch({ effects: languageConf.reconfigure(langExtension(lang)) });
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
      view.dispatch({
        effects: editableConf.reconfigure(EditorView.editable.of(isSynced)),
      });
      if (isSynced) view.focus();
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
      view.destroy();
      viewRef.current = null;
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId, themeConf]);

  // Reconfigure just the theme compartment when the app theme toggles.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeConf.reconfigure(editorTheme(theme)),
    });
  }, [theme, themeConf]);

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
            <Brand size={40} stacked />
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
            <Brand size={40} stacked />
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
          <Brand size={26} />
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
