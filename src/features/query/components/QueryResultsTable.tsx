import { useEffect, useState } from "react";
import type { QueryResult } from "../types";

interface QueryResultsTableProps {
  result: QueryResult;
}

/** Maximum rows to render in the basic table (M4 will replace with virtualization) */
const MAX_DISPLAY_ROWS = 1000;

type ActiveTab = "results" | "messages";

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
  const [activeResultSetIndex, setActiveResultSetIndex] = useState(0);

  // Default tab: Results if we have data, otherwise Messages.
  // Users can click to switch between them when both exist.
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    hasData ? "results" : "messages"
  );

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

  const activeResultSet =
    visibleResultSets[activeResultSetIndex] ?? visibleResultSets[0];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab header — both tabs are clickable when present */}
      <div className="flex border-b border-bg-tertiary bg-bg-secondary text-xs">
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

      {/* Data grid */}
      {activeTab === "results" && activeResultSet && (
        <div className="flex-1 overflow-auto">
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
              {activeResultSet.rows.slice(0, MAX_DISPLAY_ROWS).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-bg-secondary"
                >
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className="whitespace-nowrap border-b border-r border-bg-tertiary px-2 py-0.5 text-text-primary"
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
        </div>
      )}

      {/* Messages */}
      {activeTab === "messages" && hasMessages && (
        <div className="flex-1 overflow-auto p-2">
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
