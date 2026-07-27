import type { QueryTab } from "../types";

export interface QueryTabBands {
  pinned: QueryTab[];
  unpinned: QueryTab[];
}

export function partitionQueryTabs(tabs: readonly QueryTab[]): QueryTabBands {
  return {
    pinned: tabs.filter((tab) => tab.pinned === true),
    unpinned: tabs.filter((tab) => tab.pinned !== true),
  };
}

export function normalizeRestoredQueryTab(value: unknown): QueryTab | null {
  if (typeof value !== "object" || value == null) return null;
  const id = "id" in value ? value.id : undefined;
  const connectionId = "connectionId" in value ? value.connectionId : undefined;
  const database = "database" in value ? value.database : undefined;
  const title = "title" in value ? value.title : undefined;
  const kind = "kind" in value ? value.kind : undefined;
  const diagramViewId = "diagramViewId" in value ? value.diagramViewId : undefined;
  const initialSql = "initialSql" in value ? value.initialSql : undefined;
  const pinned = "pinned" in value ? value.pinned : undefined;
  if (
    typeof id !== "string" ||
    (typeof connectionId !== "string" && connectionId != null) ||
    typeof database !== "string" ||
    typeof title !== "string" ||
    (kind != null && kind !== "query" && kind !== "diagram") ||
    (diagramViewId != null && typeof diagramViewId !== "string") ||
    (initialSql != null && typeof initialSql !== "string")
  ) {
    return null;
  }

  return {
    id,
    connectionId: connectionId ?? null,
    database,
    title,
    ...(kind == null ? {} : { kind }),
    ...(diagramViewId == null ? {} : { diagramViewId }),
    ...(initialSql == null ? {} : { initialSql }),
    pinned: pinned === true,
  };
}
