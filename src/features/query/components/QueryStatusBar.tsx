import { useState, useEffect, useRef } from "react";
import { useQueryStore } from "../store/queryStore";
import { useConnectionStore } from "../../connection";
import type { QueryExecutionState } from "../types";

interface QueryStatusBarProps {
  tabId: string;
}

const STATE_LABELS: Record<QueryExecutionState, string> = {
  idle: "Ready",
  executing: "Executing...",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATE_COLORS: Record<QueryExecutionState, string> = {
  idle: "text-text-secondary",
  executing: "text-accent",
  completed: "text-success",
  failed: "text-error",
  cancelled: "text-warning",
};

export function QueryStatusBar({ tabId }: QueryStatusBarProps) {
  const tab = useQueryStore((s) => s.tabs.find((t) => t.id === tabId));
  const executionInfo = useQueryStore((s) => s.executionInfo[tabId]);
  const result = useQueryStore((s) => s.results[tabId]);
  const connections = useConnectionStore((s) => s.connections);

  const state = executionInfo?.state ?? "idle";
  const connection = tab
    ? connections.find((c) => c.id === tab.connectionId)
    : null;

  // Live timer
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === "executing" && executionInfo?.startTime) {
      const start = executionInfo.startTime;
      setElapsed(Date.now() - start);

      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - start);
      }, 100);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [state, executionInfo?.startTime]);

  const displayTime =
    state === "executing"
      ? formatDuration(elapsed)
      : result?.executionTimeMs
        ? formatDuration(result.executionTimeMs)
        : null;

  const rowCount = result?.totalRows ?? result?.rows.length ?? 0;

  return (
    <div className="flex items-center gap-4 border-t border-bg-tertiary bg-bg-secondary px-3 py-1 text-xs">
      {/* Connection info */}
      <div className="flex items-center gap-1.5">
        {tab?.connectionColor && (
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: tab.connectionColor }}
          />
        )}
        <span className="text-text-secondary">
          {connection?.name || connection?.serverName || "Disconnected"}
          {tab?.database ? ` · ${tab.database}` : ""}
        </span>
      </div>

      <div className="flex-1" />

      {/* Execution state */}
      <span className={STATE_COLORS[state]}>{STATE_LABELS[state]}</span>

      {/* Execution time */}
      {displayTime && (
        <span className="text-text-secondary">{displayTime}</span>
      )}

      {/* Row count */}
      {(state === "completed" || state === "executing") && (
        <span className="text-text-secondary">
          {rowCount.toLocaleString()} row{rowCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");

  return `${hh}:${mm}:${ss}.${mmm}`;
}
