import { useQueryStore } from "../store/queryStore";

interface QueryToolbarProps {
  tabId: string;
  onExecute: () => void;
  onCancel: () => void;
}

export function QueryToolbar({
  tabId,
  onExecute,
  onCancel,
}: QueryToolbarProps) {
  const executionInfo = useQueryStore((s) => s.executionInfo[tabId]);
  const isExecuting = executionInfo?.state === "executing";
  // Cancel can only work once the sidecar has sent back a queryId, which
  // identifies the in-flight SqlCommand to interrupt. Before that, the
  // Cancel button would be a no-op, so we keep it disabled until ready.
  const canCancel = isExecuting && executionInfo?.queryId != null;

  return (
    <div className="flex items-center gap-1 border-b border-bg-tertiary bg-bg-secondary px-2 py-1">
      {/* Execute */}
      <button
        onClick={onExecute}
        disabled={isExecuting}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        title="Execute selected SQL, or all SQL if nothing is selected (F5)"
      >
        <span className="text-success">&#9654;</span>
        Execute
      </button>

      {/* Separator */}
      <div className="mx-1 h-4 border-l border-bg-tertiary" />

      {/* Cancel */}
      <button
        onClick={onCancel}
        disabled={!canCancel}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        title={
          isExecuting && !canCancel
            ? "Starting... (cancel available once the query is registered)"
            : "Cancel Execution"
        }
      >
        <span className="text-error">&#9632;</span>
        Cancel
      </button>
    </div>
  );
}
