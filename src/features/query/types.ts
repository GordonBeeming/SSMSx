export type QueryExecutionState = "idle" | "executing" | "completed" | "failed" | "cancelled";

export interface QueryColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  maxLength?: number;
}

export interface QueryMessage {
  text: string;
  severity: "info" | "error";
  lineNumber?: number;
}

export interface QueryResultSet {
  columns: QueryColumn[];
  rows: unknown[][];
  totalRows: number;
}

export interface QueryResult {
  resultSets: QueryResultSet[];
  columns: QueryColumn[];
  rows: unknown[][];
  messages: QueryMessage[];
  executionTimeMs: number;
  totalRows: number;
}

export interface QueryTab {
  id: string;
  kind?: "query" | "diagram";
  connectionId: string | null;
  database: string;
  diagramViewId?: string;
  initialSql?: string;
  title: string;
  connectionColor?: string;
}

/** Payload shape from the sidecar streaming batches (with requestId injected by Rust) */
export interface QueryBatchPayload {
  queryId: string;
  requestId?: string;
  columns?: QueryColumn[];
  rows?: unknown[][];
  batch: number;
  done: boolean;
  executionTimeMs?: number;
  totalRows?: number;
  messages?: QueryMessage[];
  resultSetIndex?: number;
}

/** Payload for query:error events */
export interface QueryErrorPayload {
  queryId?: string;
  requestId?: string;
  error: string;
}
