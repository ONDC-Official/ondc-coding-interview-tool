import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import {
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import { defaultKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';

import type { Theme } from './theme';

export type LanguageId = 'python' | 'javascript' | 'java' | 'cpp' | 'text';

export interface LanguageOption {
  value: LanguageId;
  label: string;
}

// Languages offered in the selector. `value` is what gets stored in the shared
// Yjs doc so both peers resolve to the same highlighting.
export const LANGUAGES: LanguageOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'text', label: 'Plain Text (.txt)' },
];

export const DEFAULT_LANGUAGE: LanguageId = 'python';

// Returns the CodeMirror language extension for a stored language value.
export function langExtension(value: string): Extension {
  switch (value) {
    case 'python':
      return python();
    case 'java':
      return java();
    case 'cpp':
      return cpp();
    case 'text':
      // Plain text: no language extension, so no syntax highlighting.
      return [];
    case 'javascript':
    default:
      return javascript();
  }
}

// CodeMirror's `basicSetup` minus autocompletion AND minus the native
// `history()` / `historyKeymap`. We want syntax highlighting and auto-closing
// brackets, but NO autocomplete popup.
//
// The native history is intentionally dropped: this editor is always
// collaborative, and y-codemirror's sync plugin applies REMOTE edits as
// ordinary local changes. CodeMirror's history would therefore put the other
// peer's typing onto *your* undo stack, so Cmd-Z could revert their work and
// local/remote edits would interleave unpredictably. Undo/redo is instead
// driven by the Yjs UndoManager via `yUndoManagerKeymap` (wired up in
// Session.tsx), which only tracks local edits — correct collaborative undo.
//
// `indentUnit` makes Tab and auto-indent use 4 spaces, matching CodeMirror's
// default tab size, so indentation stays consistent across languages and with
// any literal tabs in pasted code. `contentAttributes` turns off the browser's
// own autocorrect / spellcheck / autocapitalize on the editable surface so
// typing code stays untouched.
export const editorSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  indentUnit.of('    '),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...foldKeymap,
    ...lintKeymap,
  ]),
  EditorView.contentAttributes.of({
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  }),
];

// Clean light editor theme. Syntax colors come from basicSetup's default
// highlight style (tuned for light backgrounds); this just sets the surface,
// gutter, caret and selection tones so they match the app's light palette.
const lightEditorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#ffffff', color: '#1f2328' },
    '.cm-content': { caretColor: '#1565a3' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1565a3' },
    '.cm-gutters': {
      backgroundColor: '#ffffff',
      color: '#8c959f',
      border: 'none',
      borderRight: '1px solid #e7ebef',
    },
    '.cm-activeLine': { backgroundColor: '#f6f8fa' },
    '.cm-activeLineGutter': { backgroundColor: '#f0f3f6', color: '#59636e' },
    '.cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#dbe7f6',
    },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: '#cfe0f4' },
    '.cm-foldPlaceholder': {
      backgroundColor: '#eef1f4',
      border: '1px solid #d8dee4',
      color: '#59636e',
    },
  },
  { dark: false }
);

// Editor theme extension for the active app theme. Dark uses One Dark; light
// uses the surface theme above. Swapped at runtime via a CodeMirror compartment
// so toggling the theme never tears down the editor or its collab connection.
export function editorTheme(theme: Theme): Extension {
  return theme === 'dark' ? oneDark : lightEditorTheme;
}

// WebSocket backend URL.
//  - VITE_WS_URL (optional) is an explicit override.
//  - In dev the backend runs on its own port (default 1234). We derive the host
//    from the page URL so it works whether you open localhost OR a LAN/remote IP
//    (e.g. http://13.233.69.163:5173 -> ws://13.233.69.163:1234).
//  - In a production build the single server serves both, so use same origin.
const WS_PORT = import.meta.env.VITE_WS_PORT || '1234';
// In prod the WS shares the page origin AND its sub-path (the reverse proxy
// strips the prefix before forwarding). WebsocketProvider appends "/<roomId>",
// so include the base path here (without its trailing slash).
const BASE_NO_SLASH = import.meta.env.BASE_URL.replace(/\/$/, '');
export const WS_URL: string =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? `ws://${location.hostname}:${WS_PORT}`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${BASE_NO_SLASH}`);

export interface LocalUser {
  name: string;
  color: string;
  colorLight: string;
}

// Distinct, readable colors for remote cursors/selections on a dark theme.
const USER_COLORS = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#c77dff', light: '#c77dff33' },
  { color: '#f25c54', light: '#f25c5433' },
];

const ADJECTIVES = ['Quick', 'Calm', 'Brave', 'Sharp', 'Witty', 'Bright'];
const ANIMALS = ['Fox', 'Owl', 'Lynx', 'Wolf', 'Hawk', 'Otter'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// A random identity for this tab: a friendly name + a cursor color.
export function makeLocalUser(): LocalUser {
  const c = pick(USER_COLORS);
  return {
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: c.color,
    colorLight: c.light,
  };
}
