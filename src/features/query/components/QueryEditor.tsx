import { useRef, useCallback, useEffect } from "react";
import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import type { editor as monacoEditor, IDisposable } from "monaco-editor";
import { SqlCompletionProvider } from "./intellisense/SqlCompletionProvider";
import type { IntelliSenseMetadata } from "../api/queryApi";
import { useAppEditorTheme } from "../../../shared/hooks/useAppEditorTheme";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: (sql: string) => void;
  intellisenseMetadata?: IntelliSenseMetadata | null;
}

export function QueryEditor({
  value,
  onChange,
  onExecute,
  intellisenseMetadata,
}: QueryEditorProps) {
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const completionProviderRef = useRef<SqlCompletionProvider | null>(null);
  const disposableRef = useRef<IDisposable | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const theme = useAppEditorTheme();

  // Keep latest callbacks in refs so Monaco actions always call the current ones
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

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

  // Listen for toolbar Execute; Monaco owns the current selection.
  useEffect(() => {
    const handler = () => {
      const editor = editorRef.current;
      if (!editor) return;
      executeEditorSql(editor, onExecuteRef.current);
    };
    window.addEventListener("query:execute", handler);
    return () => window.removeEventListener("query:execute", handler);
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

      // F5 — execute selected SQL, or all SQL if nothing is selected.
      editor.addAction({
        id: "query-execute",
        label: "Execute Query",
        keybindings: [monaco.KeyCode.F5],
        run: (ed) => {
          executeEditorSql(ed, onExecuteRef.current);
        },
      });

      // Keep the previous shortcut as an alias for Execute.
      editor.addAction({
        id: "query-execute-selection",
        label: "Execute Query",
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
        ],
        run: (ed) => {
          executeEditorSql(ed, onExecuteRef.current);
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
        // Keep line 1 off the top edge — Monaco renders it flush against the
        // viewport top and the overflow-hidden wrapper clips the glyph tops.
        padding: { top: 8 },
      }}
    />
  );
}

function executeEditorSql(
  editor: monacoEditor.ICodeEditor,
  onExecute: (sql: string) => void
): void {
  const model = editor.getModel();
  if (!model) return;

  const selection = editor.getSelection();
  const sql =
    selection && !selection.isEmpty()
      ? model.getValueInRange(selection)
      : model.getValue();

  if (sql.trim()) {
    onExecute(sql);
  }
}
