import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";

// Self-host Monaco from the bundle instead of @monaco-editor/react's default
// CDN loader. The packaged app runs under a strict CSP (script-src 'self'),
// which blocks the CDN fetch and leaves the editor stuck on "Loading...".
// Only the base editor worker is needed — we use Monaco for SQL editing with a
// custom completion provider, not the JSON/TS/CSS language services.
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });
