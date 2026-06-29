// Monaco web-worker wiring for Vite.
//
// Monaco offloads tokenization / language services to web workers. Vite can't
// auto-discover them, so we import each worker with `?worker` (Vite turns it
// into a constructor) and hand the right one to Monaco via MonacoEnvironment.
// `editor.worker` is the base worker every language needs; the others only
// kick in for their language (we ship js/ts so include that one). Importing
// this module for its side effect — before any monaco.editor.create — is all
// that's required.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import type { Environment } from 'monaco-editor';

declare global {
  interface Window {
    MonacoEnvironment?: Environment;
  }
}

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};
