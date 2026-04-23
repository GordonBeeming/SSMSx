import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useConnectionStore, ConnectionDialog } from "../features/connection";
import { useQueryStore, QueryPanel, QueryTabBar } from "../features/query";
import { ObjectExplorerTree } from "../features/explorer";

let tabCounter = 0;

function isMac(): boolean {
  return navigator.platform.toUpperCase().includes("MAC");
}

function App() {
  const {
    activeConnectionIds,
    connections,
    openDialog,
    disconnect,
  } = useConnectionStore();

  const activeConnections = connections.filter((c) =>
    activeConnectionIds.includes(c.id)
  );
  const hasConnections = activeConnections.length > 0;

  const { tabs, activeTabId, addTab } = useQueryStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const createNewTab = useCallback(() => {
    // Use the first active connection as default
    const defaultConn = activeConnections[0];
    if (!defaultConn) return;

    tabCounter++;
    addTab({
      id: crypto.randomUUID(),
      connectionId: defaultConn.id,
      database: defaultConn.database ?? "master",
      title: `Query ${tabCounter}`,
      connectionColor: defaultConn.color,
    });
  }, [activeConnections, addTab]);

  // Listen for new tab events from the tab bar's "+" button
  useEffect(() => {
    const handler = () => createNewTab();
    window.addEventListener("query:new-tab", handler);
    return () => window.removeEventListener("query:new-tab", handler);
  }, [createNewTab]);

  // Listen for native menu events from Tauri
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      // File > New Query
      unlisteners.push(
        await listen("menu:new-query", () => {
          createNewTab();
        })
      );

      // File > New Connection
      unlisteners.push(
        await listen("menu:new-connection", () => {
          openDialog();
        })
      );

      // File > Close Tab
      unlisteners.push(
        await listen("menu:close-tab", () => {
          const store = useQueryStore.getState();
          if (store.activeTabId) {
            store.removeTab(store.activeTabId);
          }
        })
      );

      // Query > Execute
      unlisteners.push(
        await listen("menu:execute-query", () => {
          const store = useQueryStore.getState();
          if (store.activeTabId) {
            store.executeQuery(store.activeTabId);
          }
        })
      );

      // Query > Execute Selection
      unlisteners.push(
        await listen("menu:execute-selection", () => {
          window.dispatchEvent(new CustomEvent("query:execute-selection"));
        })
      );

      // Query > Cancel
      unlisteners.push(
        await listen("menu:cancel-query", () => {
          const store = useQueryStore.getState();
          if (store.activeTabId) {
            store.cancelQuery(store.activeTabId);
          }
        })
      );
    };

    setup().catch((e) =>
      console.error("Failed to set up menu event listeners:", e)
    );

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [createNewTab, openDialog]);

  // Global keyboard shortcuts (F5 for execute when editor is not focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F5 — Execute query (global fallback when editor doesn't have focus)
      if (e.key === "F5") {
        e.preventDefault();
        const store = useQueryStore.getState();
        if (store.activeTabId) {
          store.executeQuery(store.activeTabId);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const shortcutKey = isMac() ? "⌘" : "Ctrl";

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-bg-tertiary bg-bg-secondary px-4 py-2">
        <h1 className="text-sm font-bold tracking-wide">SSMSX</h1>
        <div className="flex-1" />

        {activeConnections.length > 0 && (
          <div className="flex items-center gap-3">
            {activeConnections.map((conn) => (
              <div key={conn.id} className="flex items-center gap-1.5">
                {conn.color && (
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: conn.color }}
                  />
                )}
                <span className="text-sm text-text-primary">
                  {conn.name || conn.serverName}
                </span>
                <button
                  onClick={() => disconnect(conn.id)}
                  className="rounded border border-bg-tertiary bg-bg-primary px-1.5 py-0.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {!hasConnections && (
          <span className="text-xs text-text-secondary">Not connected</span>
        )}

        <button
          onClick={openDialog}
          className="rounded bg-accent px-3 py-1 text-sm text-accent-text hover:bg-accent-hover"
        >
          {hasConnections ? "Add Connection" : "Connect"}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Object Explorer sidebar */}
        {hasConnections && <ObjectExplorerTree />}

        {/* Content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Query tabs bar */}
          {tabs.length > 0 && <QueryTabBar />}

          {/* Tab content */}
          {activeTab ? (
            <QueryPanel />
          ) : (
            <div className="flex flex-1 items-center justify-center overflow-auto">
              {!hasConnections ? (
                <div className="text-center">
                  <p className="text-lg text-text-secondary">
                    Connect to a SQL Server to get started
                  </p>
                  <button
                    onClick={openDialog}
                    className="mt-4 rounded bg-accent px-6 py-2 text-accent-text hover:bg-accent-hover"
                  >
                    New Connection
                  </button>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  Browse objects in the explorer, or press {shortcutKey}+N for a
                  new query.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <ConnectionDialog />
    </div>
  );
}

export default App;
