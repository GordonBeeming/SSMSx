import { useQueryStore } from "../store/queryStore";

interface QueryToolbarProps {
  tabId: string;
  onExecute: () => void;
  onExecuteSelection: () => void;
  onCancel: () => void;
}

export function QueryToolbar({
  tabId,
  onExecute,
  onExecuteSelection,
  onCancel,
}: QueryToolbarProps) {
  const executionInfo = useQueryStore((s) => s.executionInfo[tabId]);
  const isExecuting = executionInfo?.state === "executing";

  return (
    <div className="flex items-center gap-1 border-b border-bg-tertiary bg-bg-secondary px-2 py-1">
      {/* Execute */}
      <button
        onClick={onExecute}
        disabled={isExecuting}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        title="Execute (F5)"
      >
        <span className="text-success">&#9654;</span>
        Execute
      </button>

      {/* Execute Selection */}
      <button
        onClick={onExecuteSelection}
        disabled={isExecuting}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        title={`Execute Selection (${isMac() ? "⌘" : "Ctrl"}+Shift+E)`}
      >
        <span className="text-accent">&#9654;&#124;</span>
        Selection
      </button>

      {/* Separator */}
      <div className="mx-1 h-4 border-l border-bg-tertiary" />

      {/* Cancel */}
      <button
        onClick={onCancel}
        disabled={!isExecuting}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        title="Cancel Execution"
      >
        <span className="text-error">&#9632;</span>
        Cancel
      </button>
    </div>
  );
}

function isMac(): boolean {
  return navigator.platform.toUpperCase().includes("MAC");
}
