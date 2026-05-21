import { create } from "zustand";
import type { ConnectionInfo, ConnectionTestResult } from "../types";
import {
  connectionList,
  connectionSave,
  connectionDelete,
  connectionTest,
  connectionConnect,
  connectionDisconnect,
} from "../api/connectionApi";
import { useExplorerStore } from "../../explorer";

export type DialogTab = "properties" | "connectionString" | "custom";

interface ConnectionState {
  connections: ConnectionInfo[];
  selectedConnection: ConnectionInfo | null;
  activeConnectionIds: string[];
  dialogOpen: boolean;
  dialogTab: DialogTab;
  loading: boolean;
  testResult: ConnectionTestResult | null;
  error: string | null;
  searchFilter: string;
  selectionVersion: number;
  formDirty: boolean;

  loadConnections: () => Promise<void>;
  setFormDirty: (dirty: boolean) => void;
  selectConnection: (c: ConnectionInfo | null) => void;
  openDialog: () => void;
  closeDialog: () => void;
  setDialogTab: (tab: DialogTab) => void;
  setSearchFilter: (filter: string) => void;
  saveConnection: (info: ConnectionInfo, password?: string, clearCredential?: boolean) => Promise<ConnectionInfo>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (
    info: ConnectionInfo,
    password?: string
  ) => Promise<ConnectionTestResult>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  isConnected: (id: string) => boolean;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  selectedConnection: null,
  activeConnectionIds: [],
  dialogOpen: false,
  dialogTab: "properties",
  loading: false,
  testResult: null,
  error: null,
  searchFilter: "",
  selectionVersion: 0,
  formDirty: false,

  setFormDirty: (dirty) => set({ formDirty: dirty }),

  loadConnections: async () => {
    try {
      const connections = await connectionList();
      set({ connections, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  selectConnection: (c) =>
    set((state) => ({
      selectedConnection: c,
      testResult: null,
      selectionVersion: state.selectionVersion + 1,
      formDirty: false,
    })),

  openDialog: () => {
    set({
      dialogOpen: true,
      dialogTab: "properties",
      testResult: null,
      error: null,
    });
    get().loadConnections();
  },

  closeDialog: () =>
    set({
      dialogOpen: false,
      selectedConnection: null,
      testResult: null,
      error: null,
    }),

  setDialogTab: (tab) => set({ dialogTab: tab }),
  setSearchFilter: (filter) => set({ searchFilter: filter }),

  saveConnection: async (info, password, clearCredential) => {
    set({ loading: true, error: null });
    try {
      const saved = await connectionSave(info, password, clearCredential);
      await get().loadConnections();
      return saved;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteConnection: async (id) => {
    set({ loading: true, error: null });
    try {
      await connectionDelete(id);
      const selected = get().selectedConnection;
      if (selected?.id === id) set({ selectedConnection: null });
      await get().loadConnections();
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loading: false });
    }
  },

  testConnection: async (info, password) => {
    set({ loading: true, testResult: null, error: null });
    try {
      const result = await connectionTest(info, password);
      set({ testResult: result });
      return result;
    } catch (e) {
      const result = { success: false, error: String(e) };
      set({ testResult: result });
      return result;
    } finally {
      set({ loading: false });
    }
  },

  connect: async (id) => {
    set({ loading: true, error: null });
    try {
      await connectionConnect(id);
      const connection = get().connections.find((c) => c.id === id);
      set((state) => ({
        activeConnectionIds: state.activeConnectionIds.includes(id)
          ? state.activeConnectionIds
          : [...state.activeConnectionIds, id],
        dialogOpen: false,
      }));
      if (connection) {
        useExplorerStore.getState().addServerNode(id, connection);
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ loading: false });
    }
  },

  disconnect: async (id) => {
    try {
      await connectionDisconnect(id);
      set((state) => ({
        activeConnectionIds: state.activeConnectionIds.filter(
          (cid) => cid !== id
        ),
      }));
      useExplorerStore.getState().removeServerNode(id);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  isConnected: (id) => get().activeConnectionIds.includes(id),
}));
