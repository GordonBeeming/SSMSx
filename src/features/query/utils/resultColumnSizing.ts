export const MIN_RESULT_COLUMN_WIDTH = 80;
export const MAX_RESULT_COLUMN_WIDTH = 500;

interface ResultColumn {
  name: string;
}

export function clampResultColumnWidth(width: number): number {
  return Math.min(MAX_RESULT_COLUMN_WIDTH, Math.max(MIN_RESULT_COLUMN_WIDTH, width));
}

export function estimateResultColumnWidths(
  columns: readonly ResultColumn[],
  rows: readonly unknown[][]
): number[] {
  return columns.map((column, columnIndex) => {
    let longest = column.name.length;
    for (const row of rows) {
      const value = row[columnIndex];
      const display = value == null ? "NULL" : typeof value === "boolean" ? "1" : String(value);
      longest = Math.max(longest, display.length);
    }
    return clampResultColumnWidth(longest * 8 + 24);
  });
}
