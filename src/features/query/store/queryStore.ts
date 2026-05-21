import { create } from "zustand";
import type {
  QueryTab,
  QueryExecutionState,
  QueryResult,
  QueryResultSet,
  QueryBatchPayload,
  QueryColumn,
  QueryMessage,
} from "../types";
import {
  queryExecute,
  queryCancel,
  intellisenseGetMetadata,
  type IntelliSenseMetadata,
} from "../api/queryApi";

interface TabExecutionInfo {
  state: QueryExecutionState;
  queryId: string | null;
  requestId: string | null;
  startTime: number | null;
}

interface QueryState {
  tabs: QueryTab[];
  activeTabId: string | null;
  tabSql: Record<string, string>;
  executionInfo: Record<string, TabExecutionInfo>;
  results: Record<string, QueryResult>;
  intellisenseCache: Record<string, IntelliSenseMetadata>;

  // Tab management
  addTab: (tab: QueryTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateSql: (tabId: string, sql: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  updateTab: (tabId: string, patch: Partial<QueryTab>) => void;

  // Query execution
  executeQuery: (tabId: string, sql?: string) => Promise<void>;
  cancelQuery: (tabId: string) => Promise<void>;

  // Streaming event handlers
  handleResultsBatch: (payload: QueryBatchPayload) => void;
  handleQueryComplete: (payload: QueryBatchPayload) => void;
  handleQueryError: (queryId: string | undefined, requestId: string | undefined, error: string) => void;

  // IntelliSense
  loadIntelliSense: (connectionId: string, database: string) => Promise<IntelliSenseMetadata | null>;

  // Helpers
  getTabExecutionState: (tabId: string) => QueryExecutionState;
  isTabDirty: (tabId: string) => boolean;
}

function emptyResult(): QueryResult {
  return {
    resultSets: [],
    columns: [],
    rows: [],
    messages: [],
    executionTimeMs: 0,
    totalRows: 0,
  };
}

/** Find the tab that owns a given queryId or requestId.
 *  Accepts multiple IDs to try (e.g. both queryId and requestId from the payload). */
function findTabByIds(
  executionInfo: Record<string, TabExecutionInfo>,
  ...ids: (string | undefined | null)[]
): string | null {
  const candidates = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  for (const [tabId, info] of Object.entries(executionInfo)) {
    for (const id of candidates) {
      if (info.queryId === id || info.requestId === id) {
        return tabId;
      }
    }
  }
  return null;
}

function updateResultSet(
  resultSets: QueryResultSet[],
  index: number,
  columns?: QueryColumn[],
  rows?: unknown[][]
): QueryResultSet[] {
  const next = [...resultSets];
  const existing = next[index] ?? { columns: [], rows: [], totalRows: 0 };
  const nextRows = [...existing.rows, ...(rows ?? [])];
  next[index] = {
    columns: columns && columns.length > 0 ? columns : existing.columns,
    rows: nextRows,
    totalRows: nextRows.length,
  };
  return next;
}

function flattenFirstResultSet(resultSets: QueryResultSet[]): Pick<QueryResult, "columns" | "rows" | "totalRows"> {
  const first = resultSets.find((set) => set.columns.length > 0 || set.rows.length > 0);
  return {
    columns: first?.columns ?? [],
    rows: first?.rows ?? [],
    totalRows: first?.totalRows ?? 0,
  };
}

export const useQueryStore = create<QueryState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  tabSql: {},
  executionInfo: {},
  results: {},
  intellisenseCache: {},

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
      tabSql: {
        ...state.tabSql,
        ...(tab.kind === "diagram" ? {} : { [tab.id]: tab.initialSql ?? "" }),
      },
    })),

  removeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      const { [id]: _sql, ...restSql } = state.tabSql;
      const { [id]: _exec, ...restExec } = state.executionInfo;
      const { [id]: _res, ...restResults } = state.results;
      return {
        tabs,
        tabSql: restSql,
        executionInfo: restExec,
        results: restResults,
        activeTabId:
          state.activeTabId === id
            ? tabs.length > 0
              ? tabs[tabs.length - 1].id
              : null
            : state.activeTabId,
      };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (tabId, patch) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...patch } : tab
      ),
    })),

  updateSql: (tabId, sql) =>
    set((state) => ({
      tabSql: { ...state.tabSql, [tabId]: sql },
    })),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { tabs };
    }),

  closeOtherTabs: (tabId) =>
    set((state) => {
      const kept = state.tabs.filter((t) => t.id === tabId);
      const removedIds = state.tabs
        .filter((t) => t.id !== tabId)
        .map((t) => t.id);

      const tabSql = { ...state.tabSql };
      const executionInfo = { ...state.executionInfo };
      const results = { ...state.results };
      for (const id of removedIds) {
        delete tabSql[id];
        delete executionInfo[id];
        delete results[id];
      }

      return {
        tabs: kept,
        activeTabId: tabId,
        tabSql,
        executionInfo,
        results,
      };
    }),

  closeAllTabs: () =>
    set({
      tabs: [],
      activeTabId: null,
      tabSql: {},
      executionInfo: {},
      results: {},
    }),

  executeQuery: async (tabId, sql) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) {
      console.error(`Cannot execute query: tab '${tabId}' not found`);
      return;
    }
    if (tab.kind === "diagram") {
      return;
    }

    // Guard against re-entry: F5/menu/toolbar can all trigger executeQuery,
    // and restarting mid-run would orphan the in-flight query in the sidecar
    // (its results would no longer be attributable to the tab).
    if (state.executionInfo[tabId]?.state === "executing") {
      console.warn(
        `Ignoring executeQuery for tab '${tabId}': already executing. Cancel first.`
      );
      return;
    }

    const queryText = sql ?? state.tabSql[tabId] ?? "";
    if (!queryText.trim()) {
      return;
    }

    // Generate the requestId client-side and store it BEFORE calling invoke.
    // This closes the race where streaming events (e.g. the sidecar's
    // immediate "started" batch) could arrive before the frontend knew
    // which tab the requestId belonged to.
    const requestId = crypto.randomUUID();

    set((s) => ({
      executionInfo: {
        ...s.executionInfo,
        [tabId]: {
          state: "executing",
          queryId: requestId,
          requestId,
          startTime: Date.now(),
        },
      },
      results: {
        ...s.results,
        [tabId]: emptyResult(),
      },
    }));

    try {
      await queryExecute(requestId, tab.connectionId, tab.database, queryText);
      // requestId is already in executionInfo — no follow-up set needed
    } catch (e) {
      console.error(`Query execution failed for tab '${tabId}':`, e);
      set((s) => ({
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            state: "failed",
            startTime: null,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            ...emptyResult(),
            messages: [
              {
                text: String(e),
                severity: "error" as const,
              },
            ],
          },
        },
      }));
    }
  },

  cancelQuery: async (tabId) => {
    const info = get().executionInfo[tabId];
    if (!info?.queryId) {
      console.warn(`Cannot cancel query for tab '${tabId}': no active queryId`);
      return;
    }

    try {
      await queryCancel(info.queryId);
    } catch (e) {
      console.error(`Failed to cancel query for tab '${tabId}':`, e);
    }
  },

  handleResultsBatch: (payload) => {
    const tabId = findTabByIds(get().executionInfo, payload.queryId, payload.requestId);
    if (!tabId) return;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      const hasResultData =
        (payload.columns && payload.columns.length > 0) ||
        (payload.rows && payload.rows.length > 0);
      const resultSets = hasResultData
        ? updateResultSet(
            existing.resultSets,
            payload.resultSetIndex ?? 0,
            payload.columns,
            payload.rows
          )
        : existing.resultSets;
      const flattened = flattenFirstResultSet(resultSets);
      const newMessages = [
        ...existing.messages,
        ...(payload.messages ?? []),
      ];

      return {
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            queryId: payload.queryId,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            resultSets,
            columns: flattened.columns,
            rows: flattened.rows,
            messages: newMessages,
            executionTimeMs: payload.executionTimeMs ?? existing.executionTimeMs,
            totalRows: flattened.totalRows,
          },
        },
      };
    });
  },

  handleQueryComplete: (payload) => {
    const tabId = findTabByIds(get().executionInfo, payload.queryId, payload.requestId);
    if (!tabId) return;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      const hasResultData =
        (payload.columns && payload.columns.length > 0) ||
        (payload.rows && payload.rows.length > 0);
      const resultSets = hasResultData
        ? updateResultSet(
            existing.resultSets,
            payload.resultSetIndex ?? 0,
            payload.columns,
            payload.rows
          )
        : existing.resultSets;
      const flattened = flattenFirstResultSet(resultSets);
      const finalMessages: QueryMessage[] = [
        ...existing.messages,
        ...(payload.messages ?? []),
      ];

      const isCancelled = finalMessages.some(
        (m) =>
          m.text.toLowerCase().includes("cancelled") ||
          m.text.toLowerCase().includes("canceled")
      );

      return {
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            state: isCancelled ? "cancelled" : "completed",
            startTime: null,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            resultSets,
            columns: flattened.columns,
            rows: flattened.rows,
            messages: finalMessages,
            executionTimeMs:
              payload.executionTimeMs ?? existing.executionTimeMs,
            totalRows: payload.totalRows ?? flattened.totalRows,
          },
        },
      };
    });
  },

  handleQueryError: (queryId, requestId, error) => {
    const tabId = findTabByIds(
      get().executionInfo,
      queryId,
      requestId
    );
    if (!tabId) return;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      return {
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            state: "failed",
            startTime: null,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            ...existing,
            messages: [
              ...existing.messages,
              { text: error, severity: "error" as const },
            ],
          },
        },
      };
    });
  },

  loadIntelliSense: async (connectionId, database) => {
    const cacheKey = `${connectionId}:${database}`;
    const cached = get().intellisenseCache[cacheKey];
    if (cached) return cached;

    try {
      const metadata = await intellisenseGetMetadata(connectionId, database);
      set((s) => ({
        intellisenseCache: {
          ...s.intellisenseCache,
          [cacheKey]: metadata,
        },
      }));
      return metadata;
    } catch (e) {
      console.error(
        `Failed to load IntelliSense for ${connectionId}/${database}:`,
        e
      );
      return null;
    }
  },

  getTabExecutionState: (tabId) => {
    return get().executionInfo[tabId]?.state ?? "idle";
  },

  isTabDirty: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.kind === "diagram") {
      return false;
    }
    const sql = get().tabSql[tabId] ?? "";
    return sql !== (tab?.initialSql ?? "");
  },
}));
