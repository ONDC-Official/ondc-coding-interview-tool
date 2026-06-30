import * as monaco from 'monaco-editor';
// Side-effect import: registers the Monaco web workers before any editor is
// created (see monaco-setup.ts).
import './monaco-setup';

import type { Theme } from '../../lib/theme';

// Language ids stored in the shared Yjs doc. Kept to the languages people
// actually use for DSA interviews / competitive programming. These match
// Monaco's own ids 1:1 (so monacoLanguage is mostly a pass-through), except
// 'c' (Monaco folds C into its C++ grammar) and 'text' (Monaco: 'plaintext').
export type LanguageId =
  | 'python'
  | 'cpp'
  | 'java'
  | 'javascript'
  | 'typescript'
  | 'c'
  | 'csharp'
  | 'go'
  | 'kotlin'
  | 'swift'
  | 'rust'
  | 'ruby'
  | 'text';

export interface LanguageOption {
  value: LanguageId;
  label: string;
}

// Languages offered in the selector. `value` is what gets stored in the shared
// Yjs doc so both peers resolve to the same highlighting.
export const LANGUAGES: LanguageOption[] = [
  // The languages people actually reach for in DSA interviews, popular first.
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'swift', label: 'Swift' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'text', label: 'Plain Text (.txt)' },
];

export const DEFAULT_LANGUAGE: LanguageId = 'python';

// Short label shown in the editor status bar (e.g. "Python", "C++").
export function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

// Maps a stored language value to Monaco's language id. Our ids match Monaco's
// for every language except the two special cases below, so everything else
// passes straight through.
export function monacoLanguage(value: string): string {
  switch (value) {
    case 'text':
      return 'plaintext';
    case 'c':
      // Monaco has no separate C grammar; its C++ grammar handles C too.
      return 'cpp';
    default:
      return value;
  }
}

// Custom Monaco themes that match the Live Coder design tokens (syntax colors,
// gutter, active-line, cursor). Defined once at module load — monaco is already
// imported here, and defineTheme is idempotent. monacoTheme() returns these ids
// and they are swapped at runtime with monaco.editor.setTheme (global), so
// toggling never tears the editor down or drops the collab connection.
const LC_DARK = 'lc-dark';
const LC_LIGHT = 'lc-light';

monaco.editor.defineTheme(LC_DARK, {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8c9bb0', fontStyle: 'italic' },
    { token: 'keyword', foreground: '79b8ff' },
    { token: 'keyword.control', foreground: '79b8ff' },
    { token: 'number', foreground: 'f2a73b' },
    { token: 'string', foreground: '7ee787' },
    { token: 'type', foreground: 'd2a8ff' },
    { token: 'type.identifier', foreground: 'd2a8ff' },
    { token: 'function', foreground: 'd2a8ff' },
    { token: 'identifier', foreground: 'e7edf5' },
    { token: 'delimiter', foreground: '8a96a8' },
  ],
  colors: {
    'editor.background': '#0b0f17',
    'editor.foreground': '#e7edf5',
    'editorLineNumber.foreground': '#5a6678',
    'editorLineNumber.activeForeground': '#8a96a8',
    'editor.lineHighlightBackground': '#11192a',
    'editor.lineHighlightBorder': '#00000000',
    'editorCursor.foreground': '#2f81f7',
    'editor.selectionBackground': '#2f81f733',
    'editorGutter.background': '#0d121d',
    'editorIndentGuide.background': '#212c3f',
    'editorIndentGuide.activeBackground': '#2c3a52',
    'editorWidget.background': '#111725',
    'editorWidget.border': '#212c3f',
    'editorScrollbarSlider.background': '#2c3a5266',
  },
});

monaco.editor.defineTheme(LC_LIGHT, {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5f6b7a', fontStyle: 'italic' },
    { token: 'keyword', foreground: '0550ae' },
    { token: 'keyword.control', foreground: '0550ae' },
    { token: 'number', foreground: 'b9740a' },
    { token: 'string', foreground: '0a7d33' },
    { token: 'type', foreground: '6f42c1' },
    { token: 'type.identifier', foreground: '6f42c1' },
    { token: 'function', foreground: '6f42c1' },
    { token: 'identifier', foreground: '16202e' },
  ],
  colors: {
    'editor.background': '#eef1f6',
    'editor.foreground': '#16202e',
    'editorLineNumber.foreground': '#9aa3b2',
    'editorLineNumber.activeForeground': '#5b6675',
    'editor.lineHighlightBackground': '#e3e8f1',
    'editor.lineHighlightBorder': '#00000000',
    'editorCursor.foreground': '#1a6fd4',
    'editor.selectionBackground': '#1a6fd433',
    'editorGutter.background': '#f7f9fc',
    'editorIndentGuide.background': '#dde3ec',
    'editorIndentGuide.activeBackground': '#cbd4e1',
  },
});

// Maps the app theme to the matching custom Monaco theme id.
export function monacoTheme(theme: Theme): string {
  return theme === 'dark' ? LC_DARK : LC_LIGHT;
}

// Editor options shared by every session. Autocomplete / suggestion popups are
// deliberately disabled: this is a DSA interview surface, and the previous
// editor intentionally shipped without them, so we keep that behaviour. Tab and
// auto-indent use 4 spaces (set on the model too); word wrap is on; the minimap
// is hidden for a cleaner, distraction-free surface.
export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  fontFamily: "'IBM Plex Mono', 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
  fontLigatures: false,
  lineHeight: 24,
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  renderWhitespace: 'selection',
  renderLineHighlight: 'all',
  padding: { top: 14, bottom: 14 },
  lineNumbersMinChars: 3,
  scrollbar: { useShadows: false },
  // No autocomplete: the interview editor is intentionally suggestion-free.
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: 'off',
  parameterHints: { enabled: false },
  tabCompletion: 'off',
  // Browser autocorrect / spellcheck off so typing code stays untouched.
  ariaLabel: 'Code editor',
};
