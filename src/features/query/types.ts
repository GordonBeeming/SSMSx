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

export interface QueryResult {
  columns: QueryColumn[];
  rows: unknown[][];
  messages: QueryMessage[];
  executionTimeMs: number;
  totalRows: number;
}

export interface QueryTab {
  id: string;
  connectionId: string;
  database: string;
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
