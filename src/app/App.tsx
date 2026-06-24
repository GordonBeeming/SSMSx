import { useEffect, useCallback, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Info } from "lucide-react";
import {
  useConnectionStore,
  ConnectionAuthProgressDialog,
  ConnectionDialog,
} from "../features/connection";
import { useQueryStore, QueryPanel, QueryTabBar } from "../features/query";
import { ObjectExplorerTree } from "../features/explorer";
import { DatabaseDiagramWorkspace } from "../features/diagram";
import { SettingsDialog, useSettingsStore } from "../features/settings";
import { isTauriRuntime } from "../shared/utils/tauri";
import { AboutDialog } from "./AboutDialog";
import type { ConnectionInfo } from "../features/connection";

let tabCounter = 0;

function isMac(): boolean {
  return navigator.platform.toUpperCase().includes("MAC");
}

function getHighestQueryNumber(tabs: { title: string }[]): number {
  return tabs.reduce((max, tab) => {
    const match = /^Query (\d+)$/.exec(tab.title);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
}

function getConnectionLabel(connection: ConnectionInfo | undefined, connectionId: string): string {
  return connection?.name || connection?.serverName || connectionId;
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

  const { tabs, activeTabId, addTab, updateTab } = useQueryStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const startupInitializedRef = useRef(false);

  const createNewTab = useCallback(() => {
    // Use the first active connection as default
    const defaultConn = activeConnections[0];
    if (!defaultConn) return;

    tabCounter++;
    addTab({
      id: crypto.randomUUID(),
      kind: "query",
      connectionId: defaultConn.id,
      database: defaultConn.database ?? "master",
      title: `Query ${tabCounter}`,
      connectionColor: defaultConn.color,
    });
  }, [activeConnections, addTab]);

  const persistQuerySession = useCallback(() => {
    const queryStore = useQueryStore.getState();
    if (useSettingsStore.getState().settings.workspace.persistQueryTabs) {
      queryStore.saveSession();
    } else {
      queryStore.discardSavedSession();
    }
  }, []);

  useEffect(() => {
    if (startupInitializedRef.current) return;
    startupInitializedRef.current = true;

    const initialize = async () => {
      const queryStore = useQueryStore.getState();
      const connectionStore = useConnectionStore.getState();
      const persistTabs =
        useSettingsStore.getState().settings.workspace.persistQueryTabs;
      if (!persistTabs) {
        queryStore.discardSavedSession();
      }

      const restored = persistTabs && queryStore.restoreSavedSession();
      tabCounter = Math.max(tabCounter, getHighestQueryNumber(queryStore.tabs));

      if (!restored) {
        await connectionStore.loadConnections();
        connectionStore.openDialog({ refreshConnections: false });
        return;
      }

      await connectionStore.loadConnections();

      const restoredConnectionIds = Array.from(
        new Set(
          useQueryStore
            .getState()
            .tabs.map((tab) => tab.connectionId)
            .filter((id): id is string => !!id)
        )
      );

      for (const connectionId of restoredConnectionIds) {
        const latestConnections = useConnectionStore.getState().connections;
        const connection = latestConnections.find((c) => c.id === connectionId);
        const shouldReconnect = window.confirm(
          `Connect to ${getConnectionLabel(connection, connectionId)} again?`
        );

        if (!shouldReconnect || !connection) {
          for (const tab of useQueryStore.getState().tabs) {
            if (tab.connectionId === connectionId) {
              useQueryStore
                .getState()
                .updateTab(tab.id, { connectionId: null, connectionColor: undefined });
            }
          }
          continue;
        }

        await useConnectionStore.getState().connect(connectionId);
        if (!useConnectionStore.getState().activeConnectionIds.includes(connectionId)) {
          for (const tab of useQueryStore.getState().tabs) {
            if (tab.connectionId === connectionId) {
              useQueryStore
                .getState()
                .updateTab(tab.id, { connectionId: null, connectionColor: undefined });
            }
          }
        }
      }

      if (
        useQueryStore.getState().tabs.length === 0 &&
        useConnectionStore.getState().activeConnectionIds.length === 0
      ) {
        useConnectionStore.getState().openDialog({ refreshConnections: false });
      }
    };

    initialize().catch((e) =>
      console.error("Failed to restore query session:", e)
    );
  }, []);

  useEffect(() => {
    let saveTimer: number | undefined;

    const schedulePersist = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(persistQuerySession, 250);
    };

    const saveNow = () => {
      window.clearTimeout(saveTimer);
      persistQuerySession();
    };

    const unsubscribeQuery = useQueryStore.subscribe((state, previousState) => {
      if (
        state.tabs !== previousState.tabs ||
        state.tabSql !== previousState.tabSql ||
        state.activeTabId !== previousState.activeTabId
      ) {
        schedulePersist();
      }
    });

    const unsubscribeSettings = useSettingsStore.subscribe(
      (state, previousState) => {
        if (
          state.settings.workspace.persistQueryTabs !==
          previousState.settings.workspace.persistQueryTabs
        ) {
          saveNow();
        }
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveNow();
      }
    };

    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    saveNow();

    return () => {
      window.clearTimeout(saveTimer);
      unsubscribeQuery();
      unsubscribeSettings();
      window.removeEventListener("pagehide", saveNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [persistQuerySession]);

  // Listen for new tab events from the tab bar's "+" button
  useEffect(() => {
    const handler = () => createNewTab();
    window.addEventListener("query:new-tab", handler);
    return () => window.removeEventListener("query:new-tab", handler);
  }, [createNewTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        connectionId: string;
        database: string;
        diagramViewId?: string;
        title?: string;
      }>).detail;
      if (detail?.connectionId && detail.database) {
        addTab({
          id: crypto.randomUUID(),
          kind: "diagram",
          connectionId: detail.connectionId,
          database: detail.database,
          diagramViewId: detail.diagramViewId,
          title: detail.title || "Database Diagram",
          connectionColor: connections.find((c) => c.id === detail.connectionId)?.color,
        });
      }
    };
    window.addEventListener("diagram:open", handler);
    return () => window.removeEventListener("diagram:open", handler);
  }, [addTab, connections]);

  // Listen for native menu events from Tauri
  useEffect(() => {
    if (!isTauriRuntime()) return;

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
          window.dispatchEvent(new CustomEvent("query:execute"));
        })
      );

      // Query > Execute Selection
      unlisteners.push(
        await listen("menu:execute-selection", () => {
          window.dispatchEvent(new CustomEvent("query:execute"));
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

      // SSMSx > Settings
      unlisteners.push(
        await listen("menu:show-settings", () => {
          setSettingsOpen(true);
        })
      );

      // SSMSx > About SSMSx
      unlisteners.push(
        await listen("menu:show-about", () => {
          setAboutOpen(true);
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
        window.dispatchEvent(new CustomEvent("query:execute"));
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
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
        <h1 className="text-sm font-bold tracking-wide">SSMSx</h1>
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
          type="button"
          onClick={() => setAboutOpen(true)}
          className="rounded p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          title="About SSMSx"
          aria-label="About SSMSx"
        >
          <Info size={16} />
        </button>

        <button
          onClick={() => openDialog()}
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
          {tabs.length > 0 && <QueryTabBar />}

          {activeTab?.kind === "diagram" && activeTab.connectionId ? (
            <DatabaseDiagramWorkspace
              connectionId={activeTab.connectionId}
              database={activeTab.database}
              diagramViewId={activeTab.diagramViewId}
              initialName={activeTab.title}
              onTitleChange={(title) => updateTab(activeTab.id, { title })}
              onClose={() => useQueryStore.getState().removeTab(activeTab.id)}
            />
          ) : activeTab?.kind === "diagram" ? (
            <div className="flex flex-1 items-center justify-center overflow-auto text-sm text-text-secondary">
              Choose a connection to view this diagram.
            </div>
          ) : activeTab ? (
            <QueryPanel />
          ) : (
            <div className="flex flex-1 items-center justify-center overflow-auto">
              {!hasConnections ? (
                <div className="h-full w-full" />
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
      <ConnectionAuthProgressDialog />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

export default App;
