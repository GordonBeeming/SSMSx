import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useQueryStore } from "../store/queryStore";
import { QueryEditor } from "./QueryEditor";
import { QueryToolbar } from "./QueryToolbar";
import { QueryStatusBar } from "./QueryStatusBar";
import { QueryResultsTable } from "./QueryResultsTable";
import type { IntelliSenseMetadata } from "../api/queryApi";

const DEFAULT_RESULTS_HEIGHT_PERCENT = 50;
const MIN_RESULTS_HEIGHT_PERCENT = 20;
const MAX_RESULTS_HEIGHT_PERCENT = 80;

function clampResultsHeight(value: number): number {
  return Math.min(
    MAX_RESULTS_HEIGHT_PERCENT,
    Math.max(MIN_RESULTS_HEIGHT_PERCENT, value)
  );
}

export function QueryPanel() {
  const { activeTabId, tabs, tabSql, updateSql, executeQuery, cancelQuery, results, loadIntelliSense } =
    useQueryStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSql = activeTabId ? tabSql[activeTabId] ?? "" : "";
  const activeResult = activeTabId ? results[activeTabId] : undefined;
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [resultsHeightPercent, setResultsHeightPercent] = useState(
    DEFAULT_RESULTS_HEIGHT_PERCENT
  );

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

  const handleResultsResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const splitContainer = splitContainerRef.current;
      if (!splitContainer) return;

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      const updateResultsHeight = (clientY: number) => {
        const rect = splitContainer.getBoundingClientRect();
        if (rect.height <= 0) return;

        const nextHeight = ((rect.bottom - clientY) / rect.height) * 100;
        setResultsHeightPercent(clampResultsHeight(nextHeight));
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateResultsHeight(moveEvent.clientY);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        updateResultsHeight(upEvent.clientY);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerUp);
    },
    []
  );

  if (!activeTab || !activeTabId || activeTab.kind === "diagram") {
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

      <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Editor area */}
        <div
          className="min-h-[120px] overflow-hidden"
          style={{
            flex: hasResults
              ? `0 0 ${100 - resultsHeightPercent}%`
              : "1 1 auto",
          }}
        >
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
          <>
            <button
              type="button"
              aria-label="Resize query results"
              title="Resize query results"
              onPointerDown={handleResultsResizePointerDown}
              className="h-2 flex-none cursor-row-resize border-y border-bg-tertiary bg-bg-secondary hover:bg-accent/15 focus:bg-accent/20 focus:outline-none"
            />
            <div
              className="flex min-h-[120px] flex-col overflow-hidden"
              style={{ flex: `0 0 ${resultsHeightPercent}%` }}
            >
              <QueryResultsTable result={activeResult} />
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <QueryStatusBar tabId={activeTabId} />
    </div>
  );
}
