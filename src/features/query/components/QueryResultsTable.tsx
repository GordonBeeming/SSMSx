import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Check, Copy, Rows3 } from "lucide-react";
import { ContextMenu } from "../../../shared/components/ContextMenu";
import type { ContextMenuItem } from "../../../shared/components/ContextMenu";
import type { QueryResult, QueryResultSet } from "../types";

interface QueryResultsTableProps {
  result: QueryResult;
}

/** Maximum rows to render in the basic table (M4 will replace with virtualization) */
const MAX_DISPLAY_ROWS = 1000;

type ActiveTab = "results" | "messages";

interface SelectedCell {
  rowIndex: number;
  colIndex: number;
}

interface GridContextMenu {
  x: number;
  y: number;
}

export function QueryResultsTable({ result }: QueryResultsTableProps) {
  const resultSets =
    result.resultSets.length > 0
      ? result.resultSets
      : [
          {
            columns: result.columns,
            rows: result.rows,
            totalRows: result.totalRows,
          },
        ];
  const visibleResultSets = resultSets.filter(
    (set) => set.columns.length > 0 || set.rows.length > 0
  );
  const hasData = visibleResultSets.length > 0;
  const hasMessages = result.messages.length > 0;
  const errorMessageKey = result.messages
    .filter((message) => message.severity === "error")
    .map((message) => `${message.lineNumber ?? ""}:${message.text}`)
    .join("\n");
  const [activeResultSetIndex, setActiveResultSetIndex] = useState(0);

  // Default tab: Results if we have data, otherwise Messages.
  // Users can click to switch between them when both exist.
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    hasData ? "results" : "messages"
  );
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [allRowsSelected, setAllRowsSelected] = useState(false);
  const [contextMenu, setContextMenu] = useState<GridContextMenu | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // If the situation changes (e.g. a new execution that only produced messages),
  // snap the active tab back to whichever has content.
  useEffect(() => {
    if (activeTab === "results" && !hasData && hasMessages) {
      setActiveTab("messages");
    } else if (activeTab === "messages" && !hasMessages && hasData) {
      setActiveTab("results");
    }
    if (activeResultSetIndex >= visibleResultSets.length) {
      setActiveResultSetIndex(0);
    }
  }, [hasData, hasMessages, activeTab, activeResultSetIndex, visibleResultSets.length]);

  useEffect(() => {
    if (errorMessageKey) {
      setActiveTab("messages");
    }
  }, [errorMessageKey]);

  const activeResultSet =
    visibleResultSets[activeResultSetIndex] ?? visibleResultSets[0];
  const visibleRows = useMemo(
    () => activeResultSet?.rows.slice(0, MAX_DISPLAY_ROWS) ?? [],
    [activeResultSet]
  );

  useEffect(() => {
    setSelectedCell(null);
    setAllRowsSelected(false);
    setContextMenu(null);
  }, [activeResultSetIndex, activeTab]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeoutId = window.setTimeout(() => setCopyStatus(null), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const copyText = useCallback(async (value: string, status: string) => {
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopyText(value);
      }
      setCopyStatus(status);
    } catch {
      fallbackCopyText(value);
      setCopyStatus(status);
    }
  }, []);

  const copyResultSet = useCallback(
    (includeHeaders: boolean) => {
      if (!activeResultSet) return;
      void copyText(
        resultSetToTsv(activeResultSet, includeHeaders),
        includeHeaders ? "Copied with headers" : "Copied data"
      );
    },
    [activeResultSet, copyText]
  );

  const copySelectedCell = useCallback(() => {
    if (!activeResultSet || !selectedCell) return;
    const value = activeResultSet.rows[selectedCell.rowIndex]?.[selectedCell.colIndex];
    void copyText(formatCell(value), "Copied cell");
  }, [activeResultSet, copyText, selectedCell]);

  const copySelectedRow = useCallback(
    (includeHeaders: boolean) => {
      if (!activeResultSet || !selectedCell) return;
      const row = activeResultSet.rows[selectedCell.rowIndex];
      if (!row) return;
      const rows = includeHeaders
        ? [activeResultSet.columns.map((column) => column.name), row]
        : [row];
      void copyText(rowsToTsv(rows), includeHeaders ? "Copied row with headers" : "Copied row");
    },
    [activeResultSet, copyText, selectedCell]
  );

  const selectCell = useCallback((rowIndex: number, colIndex: number) => {
    setSelectedCell({ rowIndex, colIndex });
    setAllRowsSelected(false);
    gridRef.current?.focus();
  }, []);

  const handleGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (activeTab !== "results" || !activeResultSet) return;

      const rowCount = visibleRows.length;
      const colCount = activeResultSet.columns.length;
      if (rowCount === 0 || colCount === 0) return;

      const currentCell = selectedCell ?? { rowIndex: 0, colIndex: 0 };
      const moveSelection = (rowDelta: number, colDelta: number) => {
        event.preventDefault();
        setSelectedCell(
          selectedCell
            ? {
                rowIndex: clampIndex(currentCell.rowIndex + rowDelta, rowCount),
                colIndex: clampIndex(currentCell.colIndex + colDelta, colCount),
              }
            : { rowIndex: 0, colIndex: 0 }
        );
        setAllRowsSelected(false);
      };

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setAllRowsSelected(true);
        setSelectedCell(null);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        if (allRowsSelected) {
          copyResultSet(event.shiftKey);
        } else if (event.shiftKey) {
          copySelectedRow(true);
        } else {
          copySelectedCell();
        }
        return;
      }

      if (event.key === "ArrowUp") {
        moveSelection(-1, 0);
      } else if (event.key === "ArrowDown") {
        moveSelection(1, 0);
      } else if (event.key === "ArrowLeft") {
        moveSelection(0, -1);
      } else if (event.key === "ArrowRight") {
        moveSelection(0, 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setSelectedCell({ rowIndex: currentCell.rowIndex, colIndex: 0 });
        setAllRowsSelected(false);
      } else if (event.key === "End") {
        event.preventDefault();
        setSelectedCell({ rowIndex: currentCell.rowIndex, colIndex: colCount - 1 });
        setAllRowsSelected(false);
      }
    },
    [
      activeResultSet,
      activeTab,
      allRowsSelected,
      copyResultSet,
      copySelectedCell,
      copySelectedRow,
      selectedCell,
      visibleRows.length,
    ]
  );

  const handleCellContextMenu = useCallback(
    (event: ReactMouseEvent, rowIndex: number, colIndex: number) => {
      event.preventDefault();
      selectCell(rowIndex, colIndex);
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [selectCell]
  );

  const contextMenuItems: ContextMenuItem[] = useMemo(
    () => [
      { type: "action", label: "Copy Cell", onClick: copySelectedCell, disabled: !selectedCell },
      {
        type: "action",
        label: "Copy Row",
        onClick: () => copySelectedRow(false),
        disabled: !selectedCell,
      },
      {
        type: "action",
        label: "Copy Row with Headers",
        onClick: () => copySelectedRow(true),
        disabled: !selectedCell,
      },
      { type: "separator" },
      {
        type: "action",
        label: "Select All",
        onClick: () => {
          setAllRowsSelected(true);
          setSelectedCell(null);
          gridRef.current?.focus();
        },
      },
      {
        type: "action",
        label: "Copy All Data",
        onClick: () => copyResultSet(false),
      },
      {
        type: "action",
        label: "Copy All with Headers",
        onClick: () => copyResultSet(true),
      },
    ],
    [copyResultSet, copySelectedCell, copySelectedRow, selectedCell]
  );

  const scrollEndPadding = <div className="h-6 flex-none" aria-hidden="true" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Tab header — both tabs are clickable when present */}
      <div className="flex border-b border-bg-tertiary bg-bg-secondary text-xs">
        <div className="flex min-w-0 flex-1">
          {hasData && (
            visibleResultSets.map((set, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setActiveTab("results");
                  setActiveResultSetIndex(index);
                }}
                className={`px-3 py-1 ${
                  activeTab === "results" && activeResultSetIndex === index
                    ? "border-b-2 border-accent text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Results {visibleResultSets.length > 1 ? index + 1 : ""} (
                {set.totalRows.toLocaleString()})
              </button>
            ))
          )}
          {hasMessages && (
            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`px-3 py-1 ${
                activeTab === "messages"
                  ? "border-b-2 border-accent text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Messages ({result.messages.length})
            </button>
          )}
        </div>

        {activeTab === "results" && activeResultSet && (
          <div className="flex items-center gap-1 border-l border-bg-tertiary px-2">
            {copyStatus && (
              <span className="flex items-center gap-1 pr-1 text-[11px] text-success">
                <Check size={12} />
                {copyStatus}
              </span>
            )}
            <button
              type="button"
              onClick={copySelectedCell}
              disabled={!selectedCell}
              className="flex items-center gap-1 px-2 py-1 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              title="Copy selected cell"
            >
              <Copy size={13} />
              Copy
            </button>
            <button
              type="button"
              onClick={() => copyResultSet(false)}
              className="flex items-center gap-1 px-2 py-1 text-text-secondary hover:text-text-primary"
              title="Copy all data without headers"
            >
              <Rows3 size={13} />
              Data
            </button>
            <button
              type="button"
              onClick={() => copyResultSet(true)}
              className="px-2 py-1 text-text-secondary hover:text-text-primary"
              title="Copy all data with headers"
            >
              Headers
            </button>
          </div>
        )}
      </div>

      {/* Data grid */}
      {activeTab === "results" && activeResultSet && (
        <div
          ref={gridRef}
          className="min-h-0 flex-1 overflow-auto focus:outline-none"
          tabIndex={0}
          role="grid"
          aria-label="Query results"
          onKeyDown={handleGridKeyDown}
        >
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-bg-secondary">
              <tr>
                {activeResultSet.columns.map((col, i) => (
                  <th
                    key={`${col.name}-${i}`}
                    className="whitespace-nowrap border-b border-r border-bg-tertiary px-2 py-1 text-left font-medium text-text-secondary"
                    title={`${col.dataType}${col.isNullable ? " (nullable)" : ""}`}
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`${allRowsSelected ? "bg-accent/10" : "hover:bg-bg-secondary"}`}
                  aria-selected={allRowsSelected}
                >
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      role="gridcell"
                      aria-selected={
                        allRowsSelected ||
                        (selectedCell?.rowIndex === rowIndex &&
                          selectedCell.colIndex === colIndex)
                      }
                      tabIndex={-1}
                      onClick={() => selectCell(rowIndex, colIndex)}
                      onContextMenu={(event) =>
                        handleCellContextMenu(event, rowIndex, colIndex)
                      }
                      className={`whitespace-nowrap border-b border-r border-bg-tertiary px-2 py-0.5 text-text-primary ${
                        selectedCell?.rowIndex === rowIndex &&
                        selectedCell.colIndex === colIndex
                          ? "bg-accent/20 outline outline-1 -outline-offset-1 outline-accent"
                          : allRowsSelected
                            ? "bg-accent/10"
                            : ""
                      }`}
                    >
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {activeResultSet.rows.length > MAX_DISPLAY_ROWS && (
            <div className="bg-bg-secondary px-3 py-1.5 text-center text-xs text-text-secondary">
              Showing {MAX_DISPLAY_ROWS.toLocaleString()} of{" "}
              {activeResultSet.totalRows.toLocaleString()} rows.
            </div>
          )}
          {scrollEndPadding}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Messages */}
      {activeTab === "messages" && hasMessages && (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {result.messages.map((msg, i) => (
            <div
              key={i}
              className={`py-0.5 font-mono text-xs ${
                msg.severity === "error"
                  ? "text-error"
                  : "text-text-secondary"
              }`}
            >
              {msg.lineNumber != null && (
                <span className="text-text-secondary">
                  Line {msg.lineNumber}:{" "}
                </span>
              )}
              {msg.text}
            </div>
          ))}
          {scrollEndPadding}
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function resultSetToTsv(resultSet: QueryResultSet, includeHeaders: boolean): string {
  const rows = includeHeaders
    ? [resultSet.columns.map((column) => column.name), ...resultSet.rows]
    : resultSet.rows;
  return rowsToTsv(rows);
}

function rowsToTsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(formatTsvValue).join("\t")).join("\n");
}

function formatTsvValue(value: unknown): string {
  const text = formatCell(value);
  if (!/[\t\r\n"]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function fallbackCopyText(value: string): void {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }
}

function clampIndex(index: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index));
}
