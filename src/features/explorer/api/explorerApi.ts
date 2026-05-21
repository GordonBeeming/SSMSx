import { invoke } from "@tauri-apps/api/core";
import type {
  DatabaseInfo,
  TableInfo,
  ViewInfo,
  ColumnInfo,
  KeyInfo,
  IndexInfo,
  StoredProcedureInfo,
  FunctionInfo,
  DatabaseUserInfo,
  ObjectScriptResult,
  DatabaseDiagramInfo,
} from "../types";

export async function explorerDatabases(
  connectionId: string
): Promise<DatabaseInfo[]> {
  const result = await invoke<string>("explorer_databases", { connectionId });
  return JSON.parse(result);
}

export async function explorerTables(
  connectionId: string,
  database: string
): Promise<TableInfo[]> {
  const result = await invoke<string>("explorer_tables", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}

export async function explorerViews(
  connectionId: string,
  database: string
): Promise<ViewInfo[]> {
  const result = await invoke<string>("explorer_views", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}

export async function explorerColumns(
  connectionId: string,
  database: string,
  schema: string,
  objectName: string
): Promise<ColumnInfo[]> {
  const result = await invoke<string>("explorer_columns", {
    connectionId,
    database,
    schema,
    objectName,
  });
  return JSON.parse(result);
}

export async function explorerKeys(
  connectionId: string,
  database: string,
  schema: string,
  tableName: string
): Promise<KeyInfo[]> {
  const result = await invoke<string>("explorer_keys", {
    connectionId,
    database,
    schema,
    tableName,
  });
  return JSON.parse(result);
}

export async function explorerIndexes(
  connectionId: string,
  database: string,
  schema: string,
  tableName: string
): Promise<IndexInfo[]> {
  const result = await invoke<string>("explorer_indexes", {
    connectionId,
    database,
    schema,
    tableName,
  });
  return JSON.parse(result);
}

export async function explorerProcedures(
  connectionId: string,
  database: string
): Promise<StoredProcedureInfo[]> {
  const result = await invoke<string>("explorer_procedures", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}

export async function explorerFunctions(
  connectionId: string,
  database: string
): Promise<FunctionInfo[]> {
  const result = await invoke<string>("explorer_functions", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}

export async function explorerUsers(
  connectionId: string,
  database: string
): Promise<DatabaseUserInfo[]> {
  const result = await invoke<string>("explorer_users", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}

export async function explorerObjectDefinition(
  connectionId: string,
  database: string,
  schema: string,
  objectName: string,
  objectType: string
): Promise<ObjectScriptResult> {
  const result = await invoke<string>("explorer_object_definition", {
    connectionId,
    database,
    schema,
    objectName,
    objectType,
  });
  return JSON.parse(result);
}

export async function explorerDatabaseDiagram(
  connectionId: string,
  database: string
): Promise<DatabaseDiagramInfo> {
  const result = await invoke<string>("explorer_database_diagram", {
    connectionId,
    database,
  });
  return JSON.parse(result);
}
