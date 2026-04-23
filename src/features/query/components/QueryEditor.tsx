import { useRef, useCallback, useEffect, useState } from "react";
import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import type { editor as monacoEditor, IDisposable } from "monaco-editor";
import { SqlCompletionProvider } from "./intellisense/SqlCompletionProvider";
import type { IntelliSenseMetadata } from "../api/queryApi";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onExecuteSelection: (sql: string) => void;
  intellisenseMetadata?: IntelliSenseMetadata | null;
}

/** Detect system color scheme preference */
function useColorScheme(): "vs" | "vs-dark" {
  const [scheme, setScheme] = useState<"vs" | "vs-dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "vs-dark" : "vs"
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setScheme(e.matches ? "vs-dark" : "vs");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return scheme;
}

export function QueryEditor({
  value,
  onChange,
  onExecute,
  onExecuteSelection,
  intellisenseMetadata,
}: QueryEditorProps) {
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const completionProviderRef = useRef<SqlCompletionProvider | null>(null);
  const disposableRef = useRef<IDisposable | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const theme = useColorScheme();

  // Keep latest callbacks in refs so Monaco actions always call the current ones
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onExecuteSelectionRef = useRef(onExecuteSelection);
  onExecuteSelectionRef.current = onExecuteSelection;

  // Update completion provider when metadata changes
  useEffect(() => {
    if (completionProviderRef.current) {
      completionProviderRef.current.setMetadata(intellisenseMetadata ?? null);
    }
  }, [intellisenseMetadata]);

  // Dispose the Monaco completion provider on unmount.
  // registerCompletionItemProvider registers globally on the Monaco module, so
  // if we don't dispose, switching tabs leaks providers and duplicates suggestions.
  useEffect(() => {
    return () => {
      disposableRef.current?.dispose();
      disposableRef.current = null;
      completionProviderRef.current = null;
    };
  }, []);

  // Listen for toolbar "Execute Selection" button
  useEffect(() => {
    const handler = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      const selection = editor.getSelection();
      let selectedText = "";
      if (selection && !selection.isEmpty()) {
        selectedText = model.getValueInRange(selection);
      } else {
        selectedText = getCurrentStatement(model, editor.getPosition());
      }

      if (selectedText.trim()) {
        onExecuteSelectionRef.current(selectedText);
      }
    };
    window.addEventListener("query:execute-selection", handler);
    return () => window.removeEventListener("query:execute-selection", handler);
  }, []);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register SQL completion provider (once per editor)
      const provider = new SqlCompletionProvider();
      provider.setMetadata(intellisenseMetadata ?? null);
      completionProviderRef.current = provider;
      disposableRef.current = monaco.languages.registerCompletionItemProvider(
        "sql",
        provider
      );

      // F5 — Execute entire query
      editor.addAction({
        id: "query-execute",
        label: "Execute Query",
        keybindings: [monaco.KeyCode.F5],
        run: () => {
          onExecuteRef.current();
        },
      });

      // Cmd/Ctrl+Shift+E — Execute selection or current statement
      editor.addAction({
        id: "query-execute-selection",
        label: "Execute Selection",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
        ],
        run: (ed) => {
          const selection = ed.getSelection();
          const model = ed.getModel();
          if (!model) return;

          let selectedText = "";
          if (selection && !selection.isEmpty()) {
            selectedText = model.getValueInRange(selection);
          } else {
            // No selection — find current statement between GO delimiters
            selectedText = getCurrentStatement(model, ed.getPosition());
          }

          if (selectedText.trim()) {
            onExecuteSelectionRef.current(selectedText);
          }
        },
      });

      editor.focus();
    },
    // Only depends on initial intellisenseMetadata — refs handle callback updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intellisenseMetadata]
  );

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? "");
    },
    [onChange]
  );

  return (
    <Editor
      defaultLanguage="sql"
      theme={theme}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        renderWhitespace: "none",
        tabSize: 4,
        insertSpaces: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
      }}
    />
  );
}

/**
 * Find the current SQL statement at the cursor position,
 * delimited by GO on its own line or start/end of file.
 */
function getCurrentStatement(
  model: monacoEditor.ITextModel,
  position: { lineNumber: number; column: number } | null
): string {
  if (!position) return model.getValue();

  const lineCount = model.getLineCount();
  const goPattern = /^\s*GO\s*$/i;

  // Search backwards from cursor to find the start of the current statement
  let startLine = 1;
  for (let i = position.lineNumber - 1; i >= 1; i--) {
    if (goPattern.test(model.getLineContent(i))) {
      startLine = i + 1;
      break;
    }
  }

  // Search forwards from cursor to find the end of the current statement
  let endLine = lineCount;
  for (let i = position.lineNumber; i <= lineCount; i++) {
    if (goPattern.test(model.getLineContent(i))) {
      endLine = i - 1;
      break;
    }
  }

  if (startLine > endLine) return "";

  const range = {
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: endLine,
    endColumn: model.getLineMaxColumn(endLine),
  };

  return model.getValueInRange(range);
}
