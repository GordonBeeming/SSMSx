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

interface CellRef {
  rowIndex: number;
  colIndex: number;
}

/**
 * A rectangular selection defined by two corners. `anchor` is where the
 * selection started (fixed while extending); `focus` is the moving/active
 * corner. A single-cell selection is just `anchor === focus`.
 */
interface CellRange {
  anchor: CellRef;
  focus: CellRef;
}

interface RangeBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

function rangeBounds(range: CellRange): RangeBounds {
  return {
    minRow: Math.min(range.anchor.rowIndex, range.focus.rowIndex),
    maxRow: Math.max(range.anchor.rowIndex, range.focus.rowIndex),
    minCol: Math.min(range.anchor.colIndex, range.focus.colIndex),
    maxCol: Math.max(range.anchor.colIndex, range.focus.colIndex),
  };
}

function isInRange(range: CellRange | null, rowIndex: number, colIndex: number): boolean {
  if (!range) return false;
  const { minRow, maxRow, minCol, maxCol } = rangeBounds(range);
  return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
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
  const [selection, setSelection] = useState<CellRange | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [allRowsSelected, setAllRowsSelected] = useState(false);
  const [contextMenu, setContextMenu] = useState<GridContextMenu | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Read inside the per-cell onMouseEnter handler; a ref avoids re-subscribing
  // every cell on each drag-state change.
  const isDraggingRef = useRef(false);

  // The active/focus cell drives keyboard navigation and single-target copies.
  const focusCell = selection?.focus ?? null;

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
    setSelection(null);
    setAllRowsSelected(false);
    setContextMenu(null);
    // activeResultSet is included so a fresh query execution (which swaps the
    // result while index/tab stay the same) clears any stale, now-out-of-bounds
    // selection instead of leaving it active on the new grid.
  }, [activeResultSetIndex, activeTab, activeResultSet]);

  // End a drag even if the pointer is released outside the grid.
  useEffect(() => {
    const stop = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

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
    if (!activeResultSet || !focusCell) return;
    const value = activeResultSet.rows[focusCell.rowIndex]?.[focusCell.colIndex];
    void copyText(formatCell(value), "Copied cell");
  }, [activeResultSet, copyText, focusCell]);

  const copySelectedRow = useCallback(
    (includeHeaders: boolean) => {
      if (!activeResultSet || !focusCell) return;
      const row = activeResultSet.rows[focusCell.rowIndex];
      if (!row) return;
      const rows = includeHeaders
        ? [activeResultSet.columns.map((column) => column.name), row]
        : [row];
      void copyText(rowsToTsv(rows), includeHeaders ? "Copied row with headers" : "Copied row");
    },
    [activeResultSet, copyText, focusCell]
  );

  // Copy the rectangular selection as TSV (the Excel/SSMS-friendly format).
  // A single-cell selection copies just that cell; multi-cell copies the block.
  const copySelectionRange = useCallback(
    (includeHeaders: boolean) => {
      if (!activeResultSet || !selection) return;
      const { minRow, maxRow, minCol, maxCol } = rangeBounds(selection);
      const body: unknown[][] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row = activeResultSet.rows[r];
        if (!row) continue;
        body.push(row.slice(minCol, maxCol + 1));
      }
      const rows = includeHeaders
        ? [
            activeResultSet.columns.slice(minCol, maxCol + 1).map((column) => column.name),
            ...body,
          ]
        : body;
      const single = minRow === maxRow && minCol === maxCol;
      const status = single
        ? "Copied cell"
        : includeHeaders
          ? "Copied selection with headers"
          : "Copied selection";
      void copyText(rowsToTsv(rows), status);
    },
    [activeResultSet, copyText, selection]
  );

  // Begin a selection (or extend it when shift is held).
  const startSelection = useCallback(
    (rowIndex: number, colIndex: number, extend: boolean) => {
      setAllRowsSelected(false);
      setSelection((prev) =>
        extend && prev
          ? { anchor: prev.anchor, focus: { rowIndex, colIndex } }
          : { anchor: { rowIndex, colIndex }, focus: { rowIndex, colIndex } }
      );
      gridRef.current?.focus();
    },
    []
  );

  const handleGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (activeTab !== "results" || !activeResultSet) return;

      const rowCount = visibleRows.length;
      const colCount = activeResultSet.columns.length;
      if (rowCount === 0 || colCount === 0) return;

      const current = focusCell ?? { rowIndex: 0, colIndex: 0 };
      // Move the focus corner. With shift, keep the anchor (grows the block);
      // without shift, collapse to a single cell at the new focus.
      const moveSelection = (rowDelta: number, colDelta: number, toCol?: number) => {
        event.preventDefault();
        const nextFocus: CellRef = {
          rowIndex: clampIndex(current.rowIndex + rowDelta, rowCount),
          colIndex:
            toCol !== undefined
              ? clampIndex(toCol, colCount)
              : clampIndex(current.colIndex + colDelta, colCount),
        };
        setSelection((prev) =>
          event.shiftKey && prev
            ? { anchor: prev.anchor, focus: nextFocus }
            : { anchor: nextFocus, focus: nextFocus }
        );
        setAllRowsSelected(false);
      };

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setAllRowsSelected(true);
        setSelection(null);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        if (allRowsSelected) {
          copyResultSet(event.shiftKey);
        } else if (selection) {
          copySelectionRange(event.shiftKey);
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
        moveSelection(0, 0, 0);
      } else if (event.key === "End") {
        moveSelection(0, 0, colCount - 1);
      }
    },
    [
      activeResultSet,
      activeTab,
      allRowsSelected,
      copyResultSet,
      copySelectionRange,
      focusCell,
      selection,
      visibleRows.length,
    ]
  );

  const handleCellContextMenu = useCallback(
    (event: ReactMouseEvent, rowIndex: number, colIndex: number) => {
      event.preventDefault();
      // Keep an existing multi-cell selection if the right-click lands inside it;
      // otherwise select the clicked cell so the copy actions act on it.
      if (!isInRange(selection, rowIndex, colIndex)) {
        startSelection(rowIndex, colIndex, false);
      }
      setContextMenu({ x: event.clientX, y: event.clientY });
    },
    [selection, startSelection]
  );

  const isMultiCellSelection = useMemo(() => {
    if (!selection) return false;
    const { minRow, maxRow, minCol, maxCol } = rangeBounds(selection);
    return minRow !== maxRow || minCol !== maxCol;
  }, [selection]);

  const contextMenuItems: ContextMenuItem[] = useMemo(
    () => [
      ...(isMultiCellSelection
        ? [
            {
              type: "action" as const,
              label: "Copy Selection",
              onClick: () => copySelectionRange(false),
            },
            {
              type: "action" as const,
              label: "Copy Selection with Headers",
              onClick: () => copySelectionRange(true),
            },
            { type: "separator" as const },
          ]
        : []),
      { type: "action", label: "Copy Cell", onClick: copySelectedCell, disabled: !focusCell },
      {
        type: "action",
        label: "Copy Row",
        onClick: () => copySelectedRow(false),
        disabled: !focusCell,
      },
      {
        type: "action",
        label: "Copy Row with Headers",
        onClick: () => copySelectedRow(true),
        disabled: !focusCell,
      },
      { type: "separator" },
      {
        type: "action",
        label: "Select All",
        onClick: () => {
          setAllRowsSelected(true);
          setSelection(null);
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
    [copyResultSet, copySelectedCell, copySelectedRow, copySelectionRange, focusCell, isMultiCellSelection]
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
              onClick={() => copySelectionRange(false)}
              disabled={!selection}
              className="flex items-center gap-1 px-2 py-1 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              title={isMultiCellSelection ? "Copy selected cells" : "Copy selected cell"}
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
          className={`min-h-0 flex-1 overflow-auto focus:outline-none ${
            isDragging ? "select-none" : ""
          }`}
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
                  {row.map((cell, colIndex) => {
                    const isFocus =
                      focusCell?.rowIndex === rowIndex &&
                      focusCell.colIndex === colIndex;
                    const inRange = isInRange(selection, rowIndex, colIndex);
                    return (
                      <td
                        key={colIndex}
                        role="gridcell"
                        aria-selected={allRowsSelected || inRange}
                        tabIndex={-1}
                        onMouseDown={(event) => {
                          // Left button only; preventDefault stops native text
                          // selection so the drag paints a clean cell rectangle.
                          if (event.button !== 0) return;
                          event.preventDefault();
                          isDraggingRef.current = true;
                          setIsDragging(true);
                          startSelection(rowIndex, colIndex, event.shiftKey);
                        }}
                        onMouseEnter={() => {
                          if (!isDraggingRef.current) return;
                          setSelection((prev) =>
                            prev
                              ? { anchor: prev.anchor, focus: { rowIndex, colIndex } }
                              : prev
                          );
                        }}
                        onContextMenu={(event) =>
                          handleCellContextMenu(event, rowIndex, colIndex)
                        }
                        className={`whitespace-nowrap border-b border-r border-bg-tertiary px-2 py-0.5 text-text-primary ${
                          isFocus
                            ? "bg-accent/20 outline outline-1 -outline-offset-1 outline-accent"
                            : inRange
                              ? "bg-accent/20"
                              : allRowsSelected
                                ? "bg-accent/10"
                                : ""
                        }`}
                      >
                        {formatCell(cell)}
                      </td>
                    );
                  })}
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
        // select-text re-enables text selection (body sets user-select: none),
        // so message/error text can be selected and copied.
        <div className="min-h-0 flex-1 overflow-auto select-text p-2">
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
