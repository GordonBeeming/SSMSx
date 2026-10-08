import { useCallback, useEffect, useRef, useState } from "react";
import { explorerDatabases } from "../../explorer/api/explorerApi";
import { useConnectionStore } from "../../connection";
import { useQueryStore } from "../store/queryStore";
import type { DatabaseInfo } from "../../explorer/types";
import { getEffectiveAlias } from "../../../shared/connectionAppearance";

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
  const pendingDatabase = useRef<{ tabId: string; connectionId: string; database: string } | null>(null);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

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
      if (!tab?.connectionId) pendingDatabase.current = null;
      return;
    }

    let cancelled = false;
    setDatabaseLoading(true);
    setDatabaseError(null);
    explorerDatabases(tab.connectionId)
      .then((items) => {
        if (!cancelled) {
          setDatabases(items.filter((db) => db.state.toUpperCase() === "ONLINE"));
          const currentTab = useQueryStore.getState().tabs.find((item) => item.id === tabId);
          if (currentTab?.connectionId !== tab.connectionId) return;
          const pending = pendingDatabase.current;
          if (pending?.tabId === tabId && pending.connectionId === tab.connectionId) {
            pendingDatabase.current = null;
            updateTab(tabId, { database: items.some((db) => db.name === pending.database) ? pending.database : "" });
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setDatabases([]);
          setDatabaseError(String(e));
          pendingDatabase.current = null;
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
  }, [isConnected, tab?.connectionId, tabId, updateTab]);

  useEffect(() => {
    const handleCancelled = (event: Event) => {
      const detail = (event as CustomEvent<{ connectionId: string | null }>).detail;
      if (
        tab?.connectionId &&
        (!detail?.connectionId || detail.connectionId === tab.connectionId) &&
        !useConnectionStore.getState().activeConnectionIds.includes(tab.connectionId)
      ) {
        updateTab(tab.id, { connectionId: null });
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
        pendingDatabase.current = null;
        updateTab(tab.id, { connectionId: null });
        return;
      }

      if (connectionId === tab.connectionId) return;
      const pending = pendingDatabase.current;
      const database = pending?.tabId === tab.id ? pending.database : tab.database;
      pendingDatabase.current = { tabId: tab.id, connectionId, database };
      setDatabases([]);
      updateTab(tab.id, { connectionId, database: "" });

      if (!activeConnectionIds.includes(connectionId)) {
        await connect(connectionId);
        if (!useConnectionStore.getState().activeConnectionIds.includes(connectionId) &&
            useQueryStore.getState().tabs.find((item) => item.id === tab.id)?.connectionId === connectionId) {
          pendingDatabase.current = null;
          updateTab(tab.id, { connectionId: null });
        }
      }
    },
    [activeConnectionIds, cancelConnectionAttempt, connect, tab, updateTab]
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
            {getEffectiveAlias(item)}
          </option>
        ))}
      </select>

      <select
        value={tab.database}
        onChange={(event) => updateTab(tab.id, { database: event.target.value })}
        disabled={!isConnected || databaseLoading}
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
