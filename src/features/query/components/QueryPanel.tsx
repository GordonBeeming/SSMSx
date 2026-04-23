import { useEffect, useCallback, useState } from "react";
import { useQueryStore } from "../store/queryStore";
import { QueryEditor } from "./QueryEditor";
import { QueryToolbar } from "./QueryToolbar";
import { QueryStatusBar } from "./QueryStatusBar";
import { QueryResultsTable } from "./QueryResultsTable";
import type { IntelliSenseMetadata } from "../api/queryApi";

export function QueryPanel() {
  const { activeTabId, tabs, tabSql, updateSql, executeQuery, cancelQuery, results, loadIntelliSense } =
    useQueryStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSql = activeTabId ? tabSql[activeTabId] ?? "" : "";
  const activeResult = activeTabId ? results[activeTabId] : undefined;

  // IntelliSense metadata for the active tab's connection/database
  const [intellisenseMetadata, setIntellisenseMetadata] =
    useState<IntelliSenseMetadata | null>(null);

  useEffect(() => {
    if (!activeTab) {
      setIntellisenseMetadata(null);
      return;
    }

    let cancelled = false;
    loadIntelliSense(activeTab.connectionId, activeTab.database).then(
      (metadata) => {
        if (!cancelled) {
          setIntellisenseMetadata(metadata ?? null);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [activeTab?.connectionId, activeTab?.database, loadIntelliSense]);

  // Note: Tauri event listeners are registered once at app startup in main.tsx
  // (via initQueryEventListeners) — not here — to avoid React strict mode
  // breaking Tauri's internal listener registry.

  const handleChange = useCallback(
    (value: string) => {
      if (activeTabId) {
        updateSql(activeTabId, value);
      }
    },
    [activeTabId, updateSql]
  );

  const handleExecute = useCallback(() => {
    if (activeTabId) {
      executeQuery(activeTabId);
    }
  }, [activeTabId, executeQuery]);

  const handleExecuteSelection = useCallback(
    (sql: string) => {
      if (activeTabId) {
        executeQuery(activeTabId, sql);
      }
    },
    [activeTabId, executeQuery]
  );

  // For toolbar "Execute Selection" button (no sql param — triggers via the editor ref)
  const handleExecuteSelectionFromToolbar = useCallback(() => {
    // Dispatch a custom event the editor can pick up to execute the current selection
    window.dispatchEvent(new CustomEvent("query:execute-selection"));
  }, []);

  const handleCancel = useCallback(() => {
    if (activeTabId) {
      cancelQuery(activeTabId);
    }
  }, [activeTabId, cancelQuery]);

  if (!activeTab || !activeTabId) {
    return null;
  }

  const hasResults =
    activeResult &&
    (activeResult.columns.length > 0 || activeResult.messages.length > 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <QueryToolbar
        tabId={activeTabId}
        onExecute={handleExecute}
        onExecuteSelection={handleExecuteSelectionFromToolbar}
        onCancel={handleCancel}
      />

      {/* Editor area */}
      <div className={`flex-1 ${hasResults ? "min-h-[120px]" : ""}`}>
        <QueryEditor
          value={activeSql}
          onChange={handleChange}
          onExecute={handleExecute}
          onExecuteSelection={handleExecuteSelection}
          intellisenseMetadata={intellisenseMetadata}
        />
      </div>

      {/* Results area */}
      {hasResults && (
        <div className="flex max-h-[50%] flex-col overflow-hidden border-t border-bg-tertiary">
          <QueryResultsTable result={activeResult} />
        </div>
      )}

      {/* Status bar */}
      <QueryStatusBar tabId={activeTabId} />
    </div>
  );
}
