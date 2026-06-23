import { useCallback, useEffect, useState } from "react";
import { explorerDatabases } from "../../explorer/api/explorerApi";
import { useConnectionStore } from "../../connection";
import { useQueryStore } from "../store/queryStore";
import type { DatabaseInfo } from "../../explorer/types";

interface QueryTargetBarProps {
  tabId: string;
}

export function QueryTargetBar({ tabId }: QueryTargetBarProps) {
  const tab = useQueryStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useQueryStore((s) => s.updateTab);
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionIds = useConnectionStore((s) => s.activeConnectionIds);
  const connect = useConnectionStore((s) => s.connect);
  const cancelConnectionAttempt = useConnectionStore((s) => s.cancelConnectionAttempt);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  const connection = tab?.connectionId
    ? connections.find((c) => c.id === tab.connectionId)
    : null;
  const isConnected =
    !!tab?.connectionId && activeConnectionIds.includes(tab.connectionId);
  const databaseOptions = databases.some((db) => db.name === tab?.database)
    ? databases
    : tab?.database
      ? [{ name: tab.database, state: "ONLINE", compatibilityLevel: 0 }, ...databases]
      : databases;

  useEffect(() => {
    if (!tab?.connectionId || !isConnected) {
      setDatabases([]);
      setDatabaseError(null);
      setDatabaseLoading(false);
      return;
    }

    let cancelled = false;
    setDatabaseLoading(true);
    setDatabaseError(null);
    explorerDatabases(tab.connectionId)
      .then((items) => {
        if (!cancelled) {
          setDatabases(items.filter((db) => db.state.toUpperCase() === "ONLINE"));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDatabases([]);
          setDatabaseError(String(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDatabaseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, tab?.connectionId]);

  useEffect(() => {
    const handleCancelled = (event: Event) => {
      const detail = (event as CustomEvent<{ connectionId: string | null }>).detail;
      if (
        tab?.connectionId &&
        (!detail?.connectionId || detail.connectionId === tab.connectionId) &&
        !useConnectionStore.getState().activeConnectionIds.includes(tab.connectionId)
      ) {
        updateTab(tab.id, { connectionId: null, connectionColor: undefined });
      }
    };

    window.addEventListener("connection:attempt-cancelled", handleCancelled);
    return () =>
      window.removeEventListener("connection:attempt-cancelled", handleCancelled);
  }, [tab?.connectionId, tab?.id, updateTab]);

  const handleConnectionChange = useCallback(
    async (connectionId: string) => {
      if (!tab) return;

      const activeRequestId = useConnectionStore.getState().activeRequestId;
      if (activeRequestId) {
        await cancelConnectionAttempt();
      }

      if (!connectionId) {
        updateTab(tab.id, { connectionId: null, connectionColor: undefined });
        return;
      }

      const nextConnection = connections.find((c) => c.id === connectionId);
      updateTab(tab.id, {
        connectionId,
        database: nextConnection?.database || tab.database || "master",
        connectionColor: nextConnection?.color,
      });

      if (!activeConnectionIds.includes(connectionId)) {
        await connect(connectionId);
        if (!useConnectionStore.getState().activeConnectionIds.includes(connectionId)) {
          updateTab(tab.id, { connectionId: null, connectionColor: undefined });
        }
      }
    },
    [activeConnectionIds, cancelConnectionAttempt, connect, connections, tab, updateTab]
  );

  if (!tab) return null;

  return (
    <div className="flex items-center gap-2 border-b border-bg-tertiary bg-bg-secondary px-2 py-1 text-xs">
      <span className="text-text-secondary">Target</span>

      <select
        value={tab.connectionId ?? ""}
        onChange={(event) => {
          void handleConnectionChange(event.target.value);
        }}
        className="h-6 min-w-[220px] rounded border border-bg-tertiary bg-bg-primary px-2 text-xs text-text-primary focus:border-accent-hover focus:outline-none"
        title="Connection"
      >
        <option value="">No connection</option>
        {connections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name || item.serverName}
          </option>
        ))}
      </select>

      <select
        value={tab.database}
        onChange={(event) => updateTab(tab.id, { database: event.target.value })}
        disabled={!isConnected}
        className="h-6 min-w-[160px] rounded border border-bg-tertiary bg-bg-primary px-2 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent-hover focus:outline-none"
        title="Database"
      >
        {!tab.database && <option value="">No database</option>}
        {databaseOptions.map((db) => (
          <option key={db.name} value={db.name}>
            {db.name}
          </option>
        ))}
      </select>

      {connection?.color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: connection.color }}
          aria-hidden="true"
        />
      )}
      <span className={isConnected ? "text-success" : "text-text-secondary"}>
        {isConnected ? "Connected" : "Disconnected"}
      </span>
      {databaseLoading && (
        <span className="text-text-secondary">Loading databases...</span>
      )}
      {databaseError && (
        <span className="truncate text-error" title={databaseError}>
          Database list unavailable
        </span>
      )}
    </div>
  );
}
