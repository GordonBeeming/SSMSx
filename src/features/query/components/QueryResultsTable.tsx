import type { QueryResult } from "../types";

interface QueryResultsTableProps {
  result: QueryResult;
}

/** Maximum rows to render in the basic table (M4 will replace with virtualization) */
const MAX_DISPLAY_ROWS = 1000;

export function QueryResultsTable({ result }: QueryResultsTableProps) {
  const hasData = result.columns.length > 0 && result.rows.length > 0;
  const hasMessages = result.messages.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Results tab header */}
      <div className="flex border-b border-bg-tertiary bg-bg-secondary text-xs">
        {hasData && (
          <span className="border-b-2 border-accent px-3 py-1 text-text-primary">
            Results ({result.totalRows.toLocaleString()})
          </span>
        )}
        {hasMessages && (
          <span
            className={`px-3 py-1 text-text-secondary ${!hasData ? "border-b-2 border-accent text-text-primary" : ""}`}
          >
            Messages ({result.messages.length})
          </span>
        )}
      </div>

      {/* Data grid */}
      {hasData && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-bg-secondary">
              <tr>
                {result.columns.map((col, i) => (
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
              {result.rows.slice(0, MAX_DISPLAY_ROWS).map((row, rowIndex) => (
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
          {result.rows.length > MAX_DISPLAY_ROWS && (
            <div className="bg-bg-secondary px-3 py-1.5 text-center text-xs text-text-secondary">
              Showing {MAX_DISPLAY_ROWS.toLocaleString()} of{" "}
              {result.totalRows.toLocaleString()} rows. Full virtualized grid
              coming in M4.
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {hasMessages && !hasData && (
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
