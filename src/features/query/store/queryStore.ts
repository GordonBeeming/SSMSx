import { create } from "zustand";
import type {
  QueryTab,
  QueryExecutionState,
  QueryResult,
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

  // Query execution
  executeQuery: (tabId: string, sql?: string) => Promise<void>;
  cancelQuery: (tabId: string) => Promise<void>;

  // Streaming event handlers
  handleResultsBatch: (payload: QueryBatchPayload) => void;
  handleQueryComplete: (payload: QueryBatchPayload) => void;
  handleQueryError: (queryIdOrRequestId: string, error: string) => void;

  // IntelliSense
  loadIntelliSense: (connectionId: string, database: string) => Promise<IntelliSenseMetadata | null>;

  // Helpers
  getTabExecutionState: (tabId: string) => QueryExecutionState;
  isTabDirty: (tabId: string) => boolean;
}

function emptyResult(): QueryResult {
  return {
    columns: [],
    rows: [],
    messages: [],
    executionTimeMs: 0,
    totalRows: 0,
  };
}

/** Find the tab that owns a given queryId or requestId */
function findTabByQueryOrRequest(
  executionInfo: Record<string, TabExecutionInfo>,
  id: string
): string | null {
  for (const [tabId, info] of Object.entries(executionInfo)) {
    if (info.queryId === id || info.requestId === id) {
      return tabId;
    }
  }
  return null;
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
        [tab.id]: tab.initialSql ?? "",
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

    const queryText = sql ?? state.tabSql[tabId] ?? "";
    if (!queryText.trim()) {
      return;
    }

    // Set executing state and clear previous results
    set((s) => ({
      executionInfo: {
        ...s.executionInfo,
        [tabId]: {
          state: "executing",
          queryId: null,
          requestId: null,
          startTime: Date.now(),
        },
      },
      results: {
        ...s.results,
        [tabId]: emptyResult(),
      },
    }));

    try {
      const response = await queryExecute(
        tab.connectionId,
        tab.database,
        queryText
      );

      // Store the requestId so we can match streaming events
      set((s) => ({
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            requestId: response.requestId,
          },
        },
      }));
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
    const tabId = findTabByQueryOrRequest(get().executionInfo, payload.queryId);
    if (!tabId) return;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      const newColumns: QueryColumn[] =
        payload.columns && payload.columns.length > 0
          ? payload.columns
          : existing.columns;
      const newRows = [...existing.rows, ...(payload.rows ?? [])];
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
            columns: newColumns,
            rows: newRows,
            messages: newMessages,
            executionTimeMs: payload.executionTimeMs ?? existing.executionTimeMs,
            totalRows: newRows.length,
          },
        },
      };
    });
  },

  handleQueryComplete: (payload) => {
    const tabId = findTabByQueryOrRequest(get().executionInfo, payload.queryId);
    if (!tabId) return;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      const newRows = [...existing.rows, ...(payload.rows ?? [])];
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
            columns:
              payload.columns && payload.columns.length > 0
                ? payload.columns
                : existing.columns,
            rows: newRows,
            messages: finalMessages,
            executionTimeMs:
              payload.executionTimeMs ?? existing.executionTimeMs,
            totalRows: payload.totalRows ?? newRows.length,
          },
        },
      };
    });
  },

  handleQueryError: (queryIdOrRequestId, error) => {
    const tabId = findTabByQueryOrRequest(
      get().executionInfo,
      queryIdOrRequestId
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
    const sql = get().tabSql[tabId] ?? "";
    return sql !== (tab?.initialSql ?? "");
  },
}));
