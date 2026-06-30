import { useCallback, useEffect, useRef, useState } from 'react';
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

// Periodically re-exchange the Yjs state vector with the server. y-websocket
// only runs the sync protocol on (re)connect; without this, any drift between a
// peer's document and the server's canonical doc never heals. 3s keeps the two
// editors converging quickly without meaningful bandwidth cost on a tiny doc.
const RESYNC_INTERVAL_MS = 3000;
// Backstop that catches the one divergence the resync above CAN'T fix: when the
// Monaco model drifts from its own local ytext (a y-monaco binding hiccup under
// rapid concurrent edits), the CRDTs agree but the *rendered* text doesn't. We
// poll for that and hard-relink the editor to the CRDT. Cheap (one string
// compare on a small doc).
const DIVERGENCE_POLL_MS = 1500;
// Debounce the same check after edits settle, so a divergence heals within a
// fraction of a second of the user pausing rather than waiting for the poll.
const DIVERGENCE_DEBOUNCE_MS = 250;
// Cursor read-out (Ln, Col) is cosmetic — throttle it so fast typing doesn't
// re-render the status bar on every keystroke.
const CURSOR_THROTTLE_MS = 100;

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
  // Sticky: true once the session has synced at least once. Used to gate the
  // big "connecting" overlay so a transient reconnect doesn't slam it shut over
  // a session that's already up (the editor stays usable; edits queue locally).
  everReady: boolean;
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
  // Sticky version of `synced`: latches true on the first sync and never drops.
  const [everReady, setEverReady] = useState(false);
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

    // gc disabled so the client-side Y.UndoManager keeps its deleted-content
    // history (mirrors the server's gc:false) and rapid delete/retype merges
    // stay predictable.
    const ydoc = new Y.Doc({ gc: false });
    // Yjs text key kept as 'codemirror' (the prior editor's key) so rooms whose
    // contents the server already persisted under it survive this editor swap.
    const ytext = ydoc.getText('codemirror');
    const ymeta = ydoc.getMap('meta');
    ymetaRef.current = ymeta;

    const provider = new WebsocketProvider(WS_URL, roomId, ydoc, {
      resyncInterval: RESYNC_INTERVAL_MS,
    });
    const awareness = provider.awareness;
    awareness.setLocalStateField('user', makeLocalUser(nameRef.current));

    // Build the Monaco editor. It starts read-only and is flipped to editable
    // once the provider reports its first sync (see onSync), so local edits can
    // never race the incoming document state.
    const initialLang = (ymeta.get('language') as LanguageId) || DEFAULT_LANGUAGE;
    const model = monaco.editor.createModel('', monacoLanguage(initialLang));
    model.updateOptions({ tabSize: 4, insertSpaces: true });
    // Force LF line endings to match Yjs (which stores '\n'). Without this a
    // CRLF model would compare unequal to ytext on every line and make the
    // divergence detector below fire constantly.
    model.setEOL(monaco.editor.EndOfLineSequence.LF);

    const editor = monaco.editor.create(editorParent.current, {
      ...EDITOR_OPTIONS,
      model,
      theme: monacoTheme(themeRef.current),
      readOnly: true,
    });

    // Bind the Monaco model to the shared Yjs text + awareness. This drives both
    // collaborative text sync AND rendering of the remote peer's cursor/selection.
    // `binding`/`undoManager` are reassignable: the divergence reconciler below
    // tears them down and rebuilds a fresh pair to re-link the model to the CRDT.
    let binding = new MonacoBinding(ytext, model, new Set([editor]), awareness);

    // Undo/redo is driven by a Yjs UndoManager scoped to the CURRENT binding's
    // edits, not Monaco's native model history. The binding applies the remote
    // peer's edits to the model as ordinary changes, so Monaco's own undo would
    // let Cmd-Z revert their work; tracking only the binding's origin keeps undo
    // local. The chord handlers below read `undoManager` lazily, so they keep
    // working after a reconcile swaps it.
    let undoManager = new Y.UndoManager(ytext, {
      trackedOrigins: new Set<unknown>([binding]),
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

    // --- Divergence reconciler -------------------------------------------------
    // The CRDT (ytext) is authoritative. If the rendered Monaco model ever drifts
    // from it (binding hiccup under rapid concurrent edits), the peers diverge
    // permanently because each shows/sends its own model. We detect that and
    // rebuild the binding so the model is re-linked to ytext. Rebuilding (rather
    // than model.setValue under the live binding) avoids fighting y-monaco's
    // internal mutex.
    let disposed = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const rebuildBinding = () => {
      const docText = ytext.toString();
      if (model.getValue() === docText) return;
      // eslint-disable-next-line no-console
      console.warn(
        '[collab] editor drifted from the shared document — reconciling to CRDT'
      );
      const viewState = editor.saveViewState();
      undoManager.destroy();
      binding.destroy();
      // Re-link a fresh binding; its constructor resets the model to ytext.
      binding = new MonacoBinding(ytext, model, new Set([editor]), awareness);
      undoManager = new Y.UndoManager(ytext, {
        trackedOrigins: new Set<unknown>([binding]),
      });
      if (viewState) editor.restoreViewState(viewState);
    };

    const checkDivergence = () => {
      if (disposed) return;
      rebuildBinding();
    };
    const scheduleDivergenceCheck = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkDivergence, DIVERGENCE_DEBOUNCE_MS);
    };
    // After any change (local typing or a remote/ytext update) re-check once the
    // dust settles; plus a periodic backstop for sustained continuous typing.
    ytext.observe(scheduleDivergenceCheck);
    const contentSub = model.onDidChangeContent(scheduleDivergenceCheck);
    const divergencePoll = setInterval(checkDivergence, DIVERGENCE_POLL_MS);

    // Status-bar cursor readout (Ln, Col), throttled so rapid cursor motion
    // doesn't re-render the UI on every keystroke.
    let pendingCursor: CursorPos | null = null;
    let cursorTimer: ReturnType<typeof setTimeout> | null = null;
    const flushCursor = () => {
      cursorTimer = null;
      if (pendingCursor) setCursor(pendingCursor);
    };
    const cursorSub = editor.onDidChangeCursorPosition((e) => {
      pendingCursor = { line: e.position.lineNumber, column: e.position.column };
      if (cursorTimer) return;
      cursorTimer = setTimeout(flushCursor, CURSOR_THROTTLE_MS);
    });

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
    // Awareness fires on every cursor move (i.e. every keystroke of the remote
    // peer), so we gate React updates on an *identity* signature: only re-render
    // when the set of peers / their names / colors actually changes, never for a
    // bare cursor move.
    let presenceSig = '';
    const updatePresence = () => {
      const entries = [...awareness.getStates().entries()];
      const sig = entries
        .map(([id, s]) => {
          const user = (s as { user?: { name?: string; color?: string } }).user;
          return `${id}:${user?.name ?? ''}:${user?.color ?? ''}`;
        })
        .sort()
        .join('|');
      if (sig === presenceSig) return;
      presenceSig = sig;
      setPeers(entries.length);
      setParticipants(
        entries.map(([, s]) => {
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

    // Editing is gated on the FIRST sync only. Before it we stay read-only so we
    // don't merge local text into the empty doc the server is about to send.
    // Once synced once, we keep the editor editable through later
    // reconnect/resync cycles — Yjs queues offline edits and merges them on
    // reconnect, so blocking input there would only lose keystrokes.
    let everSynced = false;
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
      if (isSynced && !everSynced) {
        everSynced = true;
        setEverReady(true);
        editor.updateOptions({ readOnly: false });
        // Stamp the shared start time on the first sync if nobody has yet.
        if (ymeta.get('startedAt') == null) ymeta.set('startedAt', Date.now());
        setStartedAt(ymeta.get('startedAt') as number);
        editor.focus();
      }
    };
    provider.on('sync', onSync);
    if (provider.synced) onSync(true);

    // The server closes with a custom code to reject a connection: ROOM_FULL_CODE
    // for a 3rd peer, ROOM_NOT_FOUND_CODE for a room no admin created.
    const onClose = (event: CloseEvent) => {
      if (!event) return;
      if (event.code === ROOM_NOT_FOUND_CODE) {
        setNotFound(true);
        provider.shouldConnect = false;
        provider.disconnect();
        return;
      }
      if (event.code === ROOM_FULL_CODE) {
        // A ROOM_FULL *after* we were already in the session is a transient
        // reconnect collision (our previous socket hasn't been pruned yet). Let
        // y-websocket retry — the server prunes the stale socket on the next
        // attempt. Only a ROOM_FULL on the very first join is a genuine "full".
        if (!everSynced) {
          setFull(true);
          provider.shouldConnect = false;
          provider.disconnect();
        }
      }
    };
    provider.on('connection-close', onClose);

    return () => {
      disposed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (cursorTimer) clearTimeout(cursorTimer);
      clearInterval(divergencePoll);
      ytext.unobserve(scheduleDivergenceCheck);
      ymeta.unobserve(applyLanguage);
      awareness.off('change', updatePresence);
      provider.off('status', onStatus);
      provider.off('sync', onSync);
      provider.off('connection-close', onClose);
      contentSub.dispose();
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

  const setLanguage = useCallback((value: LanguageId) => {
    // Write to the shared doc; the observer above updates both editors.
    ymetaRef.current?.set('language', value);
  }, []);

  const copyLink = useCallback(async () => {
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
  }, []);

  // Ready to edit only once connected AND the initial doc has synced.
  const ready = status === 'connected' && synced;
  const elapsedMs = startedAt == null ? null : now - startedAt;

  return {
    editorParent,
    status,
    synced,
    ready,
    everReady,
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
