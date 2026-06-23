import { useConnectionStore } from "./stores/connectionStore";
import { useQueryStore } from "./stores/queryStore";
import { ConnectionDialog } from "./components/connection/ConnectionDialog";
import { ObjectExplorerTree } from "./components/explorer/ObjectExplorerTree";

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

  const { tabs, activeTabId } = useQueryStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

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
          {tabs.length > 0 && (
            <div className="flex border-b border-bg-tertiary bg-bg-secondary">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-1 border-r border-bg-tertiary px-3 py-1.5 text-xs ${
                    tab.id === activeTabId
                      ? "bg-bg-primary text-text-primary"
                      : "text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  <button
                    className="truncate"
                    onClick={() => useQueryStore.getState().setActiveTab(tab.id)}
                  >
                    {tab.title}
                  </button>
                  <button
                    className="ml-1 text-text-secondary hover:text-text-primary"
                    onClick={() => useQueryStore.getState().removeTab(tab.id)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tab content */}
          <div className="flex flex-1 items-center justify-center overflow-auto">
            {activeTab ? (
              <div className="h-full w-full p-4">
                <pre className="h-full w-full overflow-auto rounded border border-bg-tertiary bg-bg-primary p-3 text-sm text-text-primary">
                  {activeTab.initialSql}
                </pre>
              </div>
            ) : !hasConnections ? (
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
                Browse objects in the explorer or right-click to script.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConnectionDialog />
    </div>
  );
}

export default App;
