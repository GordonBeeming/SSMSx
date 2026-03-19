import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { QueryBatchPayload, QueryErrorPayload } from "../types";

interface QueryExecuteResponse {
  requestId: string;
}

export async function queryExecute(
  connectionId: string,
  database: string,
  sql: string
): Promise<QueryExecuteResponse> {
  const result = await invoke<string>("query_execute", {
    connectionId,
    database,
    sql,
  });
  return JSON.parse(result);
}

export async function queryCancel(queryId: string): Promise<void> {
  await invoke<string>("query_cancel", { queryId });
}

export async function onQueryResults(
  handler: (payload: QueryBatchPayload) => void
): Promise<UnlistenFn> {
  return listen<QueryBatchPayload>("query:results", (event) => {
    handler(event.payload);
  });
}

export async function onQueryComplete(
  handler: (payload: QueryBatchPayload) => void
): Promise<UnlistenFn> {
  return listen<QueryBatchPayload>("query:complete", (event) => {
    handler(event.payload);
  });
}

export interface IntelliSenseMetadata {
  tables: IntelliSenseTable[];
  columns: IntelliSenseColumn[];
  procedures: IntelliSenseProcedure[];
  functions: IntelliSenseFunction[];
}

export interface IntelliSenseTable {
  schema: string;
  name: string;
  type: string;
}

export interface IntelliSenseColumn {
  schema: string;
  tableName: string;
  name: string;
  dataType: string;
}

export interface IntelliSenseProcedure {
  schema: string;
  name: string;
}

export interface IntelliSenseFunction {
  schema: string;
  name: string;
  type: string;
}

export async function intellisenseGetMetadata(
  connectionId: string,
  database: string
): Promise<IntelliSenseMetadata> {
  const result = await invoke<string>("intellisense_get_metadata", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}

export async function onQueryError(
  handler: (payload: QueryErrorPayload) => void
): Promise<UnlistenFn> {
  return listen<QueryErrorPayload>("query:error", (event) => {
    handler(event.payload);
  });
}
