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
import { useConnectionStore } from "../../connection/store/connectionStore";

const QUERY_SESSION_STORAGE_KEY = "ssmsx.querySession.v1";

interface TabExecutionInfo {
  state: QueryExecutionState;
  queryId: string | null;
  requestId: string | null;
  startTime: number | null;
  databaseContext?: string;
  databaseSyncEnabled?: boolean;
}

interface SavedQuerySession {
  version: 1;
  tabs: QueryTab[];
  tabSql: Record<string, string>;
  activeTabId: string | null;
  savedAt: string;
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
  saveSession: () => void;
  restoreSavedSession: () => boolean;
  discardSavedSession: () => void;

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

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readSavedSession(): SavedQuerySession | null {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = window.localStorage.getItem(QUERY_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedQuerySession>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.tabs) ||
      typeof parsed.tabSql !== "object" ||
      parsed.tabSql == null
    ) {
      return null;
    }

    return {
      version: 1,
      tabs: parsed.tabs.filter(isRestorableTab),
      tabSql: sanitizeTabSql(parsed.tabSql),
      activeTabId: typeof parsed.activeTabId === "string" ? parsed.activeTabId : null,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch (e) {
    console.warn("Failed to read saved query session:", e);
    return null;
  }
}

function isRestorableTab(tab: unknown): tab is QueryTab {
  if (typeof tab !== "object" || tab == null) return false;
  const candidate = tab as Partial<QueryTab>;
  return (
    typeof candidate.id === "string" &&
    (typeof candidate.connectionId === "string" ||
      candidate.connectionId == null) &&
    typeof candidate.database === "string" &&
    typeof candidate.title === "string" &&
    (candidate.kind == null ||
      candidate.kind === "query" ||
      candidate.kind === "diagram")
  );
}

function sanitizeTabSql(tabSql: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tabSql).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

function buildSavedTabs(tabs: QueryTab[], tabSql: Record<string, string>): QueryTab[] {
  return tabs.map((tab) =>
    tab.kind === "diagram"
      ? tab
      : {
          ...tab,
          initialSql: tabSql[tab.id] ?? tab.initialSql ?? "",
        }
  );
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
    set((state) => {
      const execution = state.executionInfo[tabId];
      return {
        tabs: state.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...patch } : tab
        ),
        executionInfo:
          patch.database !== undefined && execution?.state === "executing"
            ? {
                ...state.executionInfo,
                [tabId]: { ...execution, databaseSyncEnabled: false },
              }
            : state.executionInfo,
      };
    }),

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

  saveSession: () => {
    if (!canUseLocalStorage()) return;

    const state = get();
    if (state.tabs.length === 0) {
      window.localStorage.removeItem(QUERY_SESSION_STORAGE_KEY);
      return;
    }

    const tabSql = Object.fromEntries(
      Object.entries(state.tabSql).filter(([tabId]) =>
        state.tabs.some((tab) => tab.id === tabId)
      )
    );

    const session: SavedQuerySession = {
      version: 1,
      tabs: buildSavedTabs(state.tabs, tabSql),
      tabSql,
      activeTabId: state.activeTabId,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(QUERY_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn("Failed to save query session:", e);
    }
  },

  restoreSavedSession: () => {
    const session = readSavedSession();
    if (!session || session.tabs.length === 0) {
      return false;
    }

    const tabIds = new Set(session.tabs.map((tab) => tab.id));
    const activeTabId =
      session.activeTabId && tabIds.has(session.activeTabId)
        ? session.activeTabId
        : session.tabs[0].id;
    const tabSql = Object.fromEntries(
      session.tabs
        .filter((tab) => tab.kind !== "diagram")
        .map((tab) => [tab.id, session.tabSql[tab.id] ?? tab.initialSql ?? ""])
    );

    set({
      tabs: buildSavedTabs(session.tabs, tabSql),
      activeTabId,
      tabSql,
      executionInfo: {},
      results: {},
    });

    return true;
  },

  discardSavedSession: () => {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(QUERY_SESSION_STORAGE_KEY);
  },

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
    if (!tab.connectionId) {
      set((s) => ({
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            state: "failed",
            queryId: null,
            requestId: null,
            startTime: null,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            ...emptyResult(),
            messages: [
              {
                text: "Choose a connection before executing this query.",
                severity: "error" as const,
              },
            ],
          },
        },
      }));
      return;
    }
    if (!useConnectionStore.getState().activeConnectionIds.includes(tab.connectionId)) {
      set((s) => ({
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            state: "failed",
            queryId: null,
            requestId: null,
            startTime: null,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            ...emptyResult(),
            messages: [
              {
                text: "Connect the selected connection before executing this query.",
                severity: "error" as const,
              },
            ],
          },
        },
      }));
      return;
    }
    if (!tab.database.trim()) {
      set((s) => ({
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            state: "failed",
            queryId: null,
            requestId: null,
            startTime: null,
          },
        },
        results: {
          ...s.results,
          [tabId]: {
            ...emptyResult(),
            messages: [
              {
                text: "Choose a database before executing this query.",
                severity: "error" as const,
              },
            ],
          },
        },
      }));
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
          databaseContext: tab.database,
          databaseSyncEnabled: true,
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
    const database = payload.database;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      const execution = s.executionInfo[tabId];
      const currentTab = s.tabs.find((tab) => tab.id === tabId);
      const databaseSyncEnabled =
        execution?.databaseSyncEnabled !== false &&
        currentTab?.database === execution?.databaseContext;
      const tabs =
        database &&
        databaseSyncEnabled &&
        currentTab?.database !== database
          ? s.tabs.map((tab) => (tab.id === tabId ? { ...tab, database } : tab))
          : s.tabs;
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
        tabs,
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            queryId: payload.queryId,
            databaseContext: database ?? execution?.databaseContext,
            databaseSyncEnabled,
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
    const database = payload.database;

    set((s) => {
      const existing = s.results[tabId] ?? emptyResult();
      const execution = s.executionInfo[tabId];
      const currentTab = s.tabs.find((tab) => tab.id === tabId);
      const databaseSyncEnabled =
        execution?.databaseSyncEnabled !== false &&
        currentTab?.database === execution?.databaseContext;
      const tabs =
        database &&
        databaseSyncEnabled &&
        currentTab?.database !== database
          ? s.tabs.map((tab) => (tab.id === tabId ? { ...tab, database } : tab))
          : s.tabs;
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
        tabs,
        executionInfo: {
          ...s.executionInfo,
          [tabId]: {
            ...s.executionInfo[tabId],
            state: isCancelled ? "cancelled" : "completed",
            startTime: null,
            databaseContext: database ?? execution?.databaseContext,
            databaseSyncEnabled,
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
