import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import * as monaco from 'monaco-editor';
import type { Theme } from '../../lib/theme';
import { WS_URL, makeLocalUser } from '../../lib/collab';
import {
  DEFAULT_LANGUAGE,
  EDITOR_OPTIONS,
  monacoLanguage,
  monacoTheme,
  type LanguageId,
} from './editor.config';

// Server close code used to signal "room already has 2 people".
const ROOM_FULL_CODE = 4001;
// Server close code: room was never created by an admin, or has been ended.
const ROOM_NOT_FOUND_CODE = 4004;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface CursorPos {
  line: number;
  column: number;
}

export interface Participant {
  name: string;
  color: string;
}

export interface CollabSession {
  editorParent: React.RefObject<HTMLDivElement>;
  status: ConnectionStatus;
  synced: boolean;
  ready: boolean;
  peers: number;
  participants: Participant[];
  full: boolean;
  notFound: boolean;
  language: LanguageId;
  setLanguage: (value: LanguageId) => void;
  cursor: CursorPos;
  elapsedMs: number | null;
  copied: boolean;
  copyLink: () => Promise<void>;
}

interface Options {
  roomId: string | undefined;
  // The candidate's display name (from the join gate) or the admin's handle.
  // Read once when the connection is built.
  displayName: string;
  theme: Theme;
  // Only connect once the user has committed to joining (admin auto-joins, a
  // candidate joins after submitting the gate). Before this the editor is not
  // mounted and no WebSocket is opened.
  active: boolean;
}

// Owns the whole collaborative editing lifecycle for one room: the Yjs doc, the
// WebSocket provider, the Monaco editor + binding, awareness/presence, language
// sync, and the connection-state machine. Lifted verbatim out of the old
// Session component; the UI is now a thin shell around the returned state.
export function useCollabSession({
  roomId,
  displayName,
  theme,
  active,
}: Options): CollabSession {
  const editorParent = useRef<HTMLDivElement>(null);
  const ymetaRef = useRef<Y.Map<unknown> | null>(null);

  // Latest values read by the build effect (which is keyed on roomId/active
  // only, so it doesn't tear the connection down when these change).
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const nameRef = useRef(displayName);
  nameRef.current = displayName;

  const [language, setLanguageState] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  // True once the initial document state has been received from the server.
  // Editing is blocked until then (see the build effect) so we never type into
  // an un-synced doc and have the bulk sync later remap the cursor / merge text.
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [full, setFull] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cursor, setCursor] = useState<CursorPos>({ line: 1, column: 1 });
  // Shared session start: the first peer to sync stamps it into the doc, so both
  // sides show the same elapsed time (an approximation of the admin's createdAt,
  // which the editor never receives).
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !roomId || !editorParent.current) return;

    const ydoc = new Y.Doc();
    // Yjs text key kept as 'codemirror' (the prior editor's key) so rooms whose
    // contents the server already persisted under it survive this editor swap.
    const ytext = ydoc.getText('codemirror');
    const ymeta = ydoc.getMap('meta');
    ymetaRef.current = ymeta;

    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);
    const awareness = provider.awareness;
    awareness.setLocalStateField('user', makeLocalUser(nameRef.current));

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

    // Status-bar cursor readout (Ln, Col).
    const cursorSub = editor.onDidChangeCursorPosition((e) =>
      setCursor({ line: e.position.lineNumber, column: e.position.column })
    );

    // Language lives in the shared doc, so a change by either peer (or the
    // already-synced state seen by a late joiner) updates both editors.
    const applyLanguage = () => {
      const lang = (ymeta.get('language') as LanguageId) || DEFAULT_LANGUAGE;
      setLanguageState(lang);
      monaco.editor.setModelLanguage(model, monacoLanguage(lang));
    };
    ymeta.observe(applyLanguage);
    applyLanguage();

    // Presence: awareness states carry each peer's display name + cursor color
    // (incl. self). Drives both the connected count and the names popover.
    const updatePresence = () => {
      const states = [...awareness.getStates().values()];
      setPeers(states.length);
      setParticipants(
        states.map((s) => {
          const user = (s as { user?: { name?: string; color?: string } }).user;
          return {
            name: user?.name?.trim() || 'Guest',
            color: user?.color || 'var(--accent)',
          };
        })
      );
    };
    awareness.on('change', updatePresence);
    updatePresence();

    const onStatus = (e: { status: ConnectionStatus }) => setStatus(e.status);
    provider.on('status', onStatus);

    // Editing is enabled only while synced. This blocks input before the first
    // sync (so we don't merge our text into the doc the server is about to
    // send) and pauses it during a reconnect re-sync, then restores focus.
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
      editor.updateOptions({ readOnly: !isSynced });
      if (isSynced) {
        // Stamp the shared start time on the first sync if nobody has yet.
        if (ymeta.get('startedAt') == null) ymeta.set('startedAt', Date.now());
        setStartedAt(ymeta.get('startedAt') as number);
        editor.focus();
      }
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
      awareness.off('change', updatePresence);
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      provider.off('connection-close', onClose);
      cursorSub.dispose();
      undoManager.destroy();
      binding.destroy();
      editor.dispose();
      model.dispose();
      provider.destroy();
      ydoc.destroy();
      ymetaRef.current = null;
    };
  }, [roomId, active]);

  // Swap Monaco's theme when the app theme toggles. setTheme is global (one
  // editor here) and never rebuilds the editor, so the collab connection holds.
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme(theme));
  }, [theme]);

  // Tick once a second to drive the elapsed timer (only while a start time is
  // known, i.e. after the first sync).
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const setLanguage = (value: LanguageId) => {
    // Write to the shared doc; the observer above updates both editors.
    ymetaRef.current?.set('language', value);
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

  // Ready to edit only once connected AND the initial doc has synced.
  const ready = status === 'connected' && synced;
  const elapsedMs = startedAt == null ? null : now - startedAt;

  return {
    editorParent,
    status,
    synced,
    ready,
    peers,
    participants,
    full,
    notFound,
    language,
    setLanguage,
    cursor,
    elapsedMs,
    copied,
    copyLink,
  };
}
