import { create } from "zustand";
import type { ConnectionInfo } from "../../connection/types";
import type { ExplorerNode } from "../types";
import { useSettingsStore } from "../../settings";
import {
  explorerDatabases,
  explorerTables,
  explorerViews,
  explorerColumns,
  explorerKeys,
  explorerIndexes,
  explorerProcedures,
  explorerFunctions,
  explorerUsers,
} from "../api/explorerApi";
import { loadSavedDiagramViews } from "../../diagram/utils/savedDiagrams";

interface ExplorerState {
  nodes: Record<string, ExplorerNode>;
  rootNodeIds: string[];
  selectedNodeId: string | null;

  addServerNode: (connectionId: string, connection: ConnectionInfo) => void;
  removeServerNode: (connectionId: string) => void;
  toggleExpand: (nodeId: string) => Promise<void>;
  refreshNode: (nodeId: string) => Promise<void>;
  refreshLoadedTableFolders: () => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  getVisibleNodes: () => { node: ExplorerNode; depth: number }[];
}

function makeNodeId(connectionId: string, ...parts: string[]) {
  return `${connectionId}/${parts.join("/")}`;
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  nodes: {},
  rootNodeIds: [],
  selectedNodeId: null,

  addServerNode: (connectionId, connection) => {
    const nodeId = makeNodeId(connectionId, "server");
    set((state) => {
      if (state.rootNodeIds.includes(nodeId)) return state;
      const node: ExplorerNode = {
        id: nodeId,
        connectionId,
        type: "server",
        name: connection.name || connection.serverName,
        expanded: false,
        loading: false,
        loaded: false,
        children: [],
        parentId: null,
        color: connection.color,
        hasChildren: true,
      };
      return {
        nodes: { ...state.nodes, [nodeId]: node },
        rootNodeIds: [...state.rootNodeIds, nodeId],
      };
    });
  },

  removeServerNode: (connectionId) => {
    const nodeId = makeNodeId(connectionId, "server");
    set((state) => {
      const newNodes = { ...state.nodes };
      // Remove all nodes for this connection
      for (const key of Object.keys(newNodes)) {
        if (key.startsWith(`${connectionId}/`)) {
          delete newNodes[key];
        }
      }
      return {
        nodes: newNodes,
        rootNodeIds: state.rootNodeIds.filter((id) => id !== nodeId),
        selectedNodeId:
          state.selectedNodeId?.startsWith(`${connectionId}/`)
            ? null
            : state.selectedNodeId,
      };
    });
  },

  toggleExpand: async (nodeId) => {
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return;

    if (node.expanded) {
      // Collapse — also cancel loading state if in-flight
      set((s) => ({
        nodes: { ...s.nodes, [nodeId]: { ...s.nodes[nodeId], expanded: false, loading: false } },
      }));
      return;
    }

    // Expand
    if (node.loaded) {
      set((s) => ({
        nodes: { ...s.nodes, [nodeId]: { ...node, expanded: true } },
      }));
      return;
    }

    // Need to fetch children
    set((s) => ({
      nodes: {
        ...s.nodes,
        [nodeId]: { ...node, loading: true, expanded: true },
      },
    }));

    try {
      const newNodes = await fetchChildren(node);
      set((s) => {
        const updatedNodes = { ...s.nodes };
        const childIds: string[] = [];
        for (const child of newNodes) {
          updatedNodes[child.id] = child;
          childIds.push(child.id);
        }
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          loading: false,
          loaded: true,
          expanded: true,
          children: childIds,
        };
        return { nodes: updatedNodes };
      });
    } catch (err) {
      console.error(`Failed to fetch children for node ${nodeId}:`, err);
      set((s) => ({
        nodes: {
          ...s.nodes,
          [nodeId]: {
            ...s.nodes[nodeId],
            loading: false,
            loaded: false,
            expanded: false,
            children: [],
          },
        },
      }));
    }
  },

  refreshNode: async (nodeId) => {
    const state = get();
    const node = state.nodes[nodeId];
    if (!node) return;

    // Remove all descendants
    set((s) => {
      const newNodes = { ...s.nodes };
      const removeDescendants = (id: string) => {
        const n = newNodes[id];
        if (!n) return;
        for (const childId of n.children) {
          removeDescendants(childId);
          delete newNodes[childId];
        }
      };
      removeDescendants(nodeId);
      newNodes[nodeId] = {
        ...node,
        loaded: false,
        expanded: false,
        children: [],
        tableCache: node.type === "schema" ? undefined : node.tableCache,
      };
      return { nodes: newNodes };
    });

    // Re-expand to trigger fetch
    await get().toggleExpand(nodeId);
  },

  refreshLoadedTableFolders: async () => {
    const tableFolderIds = Object.values(get().nodes)
      .filter(
        (node) =>
          node.type === "folder" &&
          node.folderKind === "tables" &&
          node.loaded
      )
      .map((node) => node.id);

    for (const nodeId of tableFolderIds) {
      await get().refreshNode(nodeId);
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  getVisibleNodes: () => {
    const { nodes, rootNodeIds } = get();
    const result: { node: ExplorerNode; depth: number }[] = [];

    function walk(nodeId: string, depth: number) {
      const node = nodes[nodeId];
      if (!node) return;
      result.push({ node, depth });
      if (node.expanded) {
        for (const childId of node.children) {
          walk(childId, depth + 1);
        }
      }
    }

    for (const id of rootNodeIds) {
      walk(id, 0);
    }
    return result;
  },
}));

async function fetchChildren(node: ExplorerNode): Promise<ExplorerNode[]> {
  const { connectionId } = node;
  const children: ExplorerNode[] = [];

  switch (node.type) {
    case "server": {
      const databases = await explorerDatabases(connectionId);
      for (const db of databases) {
        children.push({
          id: makeNodeId(connectionId, "db", db.name),
          connectionId,
          type: "database",
          name: db.name,
          database: db.name,
          expanded: false,
          loading: false,
          loaded: false,
          children: [],
          parentId: node.id,
          hasChildren: true,
        });
      }
      break;
    }

    case "database": {
      if (!node.database) {
        console.error(`Expected database on node ${node.id} but it was undefined`);
        return children;
      }
      const db = node.database;
      const folders = [
        { kind: "diagrams", label: "Diagrams" },
        { kind: "tables", label: "Tables" },
        { kind: "views", label: "Views" },
        { kind: "programmability", label: "Programmability" },
        { kind: "security", label: "Security" },
      ];
      for (const f of folders) {
        children.push({
          id: makeNodeId(connectionId, "db", db, f.kind),
          connectionId,
          type: "folder",
          name: f.label,
          database: db,
          expanded: false,
          loading: false,
          loaded: false,
          children: [],
          parentId: node.id,
          hasChildren: true,
          folderKind: f.kind,
        });
      }
      break;
    }

    case "folder":
    case "schema": {
      if (!node.database) {
        console.error(`Expected database on node ${node.id} but it was undefined`);
        return children;
      }
      const db = node.database;
      switch (node.folderKind) {
        case "diagrams": {
          const diagrams = loadSavedDiagramViews(connectionId, db);
          for (const diagram of diagrams) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "diagram", diagram.id),
              connectionId,
              type: "diagram",
              name: diagram.name,
              database: db,
              diagramViewId: diagram.id,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
        case "tables": {
          const tables = await explorerTables(connectionId, db);
          const groupTablesBySchema =
            useSettingsStore.getState().settings.explorer.groupTablesBySchema;

          if (groupTablesBySchema) {
            const schemas = Array.from(new Set(tables.map((t) => t.schema))).sort(
              (a, b) => a.localeCompare(b)
            );
            for (const schema of schemas) {
              children.push({
                id: makeNodeId(connectionId, "db", db, "schema", schema),
                connectionId,
                type: "schema",
                name: schema,
                schema,
                database: db,
                tableCache: tables,
                expanded: false,
                loading: false,
                loaded: false,
                children: [],
                parentId: node.id,
                hasChildren: true,
                folderKind: "table-schema",
              });
            }
            break;
          }

          for (const t of tables) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "table", t.schema, t.name),
              connectionId,
              type: "table",
              name: t.name,
              label: `${t.schema}.${t.name}`,
              schema: t.schema,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: true,
            });
          }
          break;
        }
        case "table-schema": {
          if (!node.schema) {
            console.error(`Expected schema on node ${node.id} but it was undefined`);
            return children;
          }

          const tables = node.tableCache ?? (await explorerTables(connectionId, db));
          for (const t of tables.filter((table) => table.schema === node.schema)) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "table", t.schema, t.name),
              connectionId,
              type: "table",
              name: t.name,
              schema: t.schema,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: true,
            });
          }
          break;
        }
        case "views": {
          const views = await explorerViews(connectionId, db);
          for (const v of views) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "view", v.schema, v.name),
              connectionId,
              type: "view",
              name: v.name,
              label: `${v.schema}.${v.name}`,
              schema: v.schema,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: true,
            });
          }
          break;
        }
        case "programmability": {
          const subFolders = [
            { kind: "procedures", label: "Stored Procedures" },
            { kind: "functions", label: "Functions" },
          ];
          for (const sf of subFolders) {
            children.push({
              id: makeNodeId(connectionId, "db", db, sf.kind),
              connectionId,
              type: "folder",
              name: sf.label,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: true,
              folderKind: sf.kind,
            });
          }
          break;
        }
        case "security": {
          children.push({
            id: makeNodeId(connectionId, "db", db, "users"),
            connectionId,
            type: "folder",
            name: "Users",
            database: db,
            expanded: false,
            loading: false,
            loaded: false,
            children: [],
            parentId: node.id,
            hasChildren: true,
            folderKind: "users",
          });
          break;
        }
        case "procedures": {
          const procs = await explorerProcedures(connectionId, db);
          for (const p of procs) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "proc", p.schema, p.name),
              connectionId,
              type: "procedure",
              name: p.name,
              label: `${p.schema}.${p.name}`,
              schema: p.schema,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
        case "functions": {
          const funcs = await explorerFunctions(connectionId, db);
          for (const f of funcs) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "func", f.schema, f.name),
              connectionId,
              type: "function",
              name: f.name,
              label: `${f.schema}.${f.name}`,
              schema: f.schema,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
        case "users": {
          const users = await explorerUsers(connectionId, db);
          for (const u of users) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "user", u.name),
              connectionId,
              type: "user",
              name: u.name,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
        case "table-columns": {
          if (!node.schema) {
            console.error(`Expected schema on node ${node.id} but it was undefined`);
            return children;
          }
          if (!node.tableName) {
            console.error(`Expected tableName on node ${node.id} but it was undefined`);
            return children;
          }
          const columns = await explorerColumns(
            connectionId,
            db,
            node.schema,
            node.tableName
          );
          for (const col of columns) {
            children.push({
              id: makeNodeId(connectionId, "db", db, "col", node.schema, node.tableName, col.name),
              connectionId,
              type: "column",
              name: col.name,
              label: `${col.name} (${col.dataType}${col.isNullable ? ", null" : ""})`,
              schema: node.schema,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
        case "table-keys": {
          if (!node.schema) {
            console.error(`Expected schema on node ${node.id} but it was undefined`);
            return children;
          }
          if (!node.tableName) {
            console.error(`Expected tableName on node ${node.id} but it was undefined`);
            return children;
          }
          const keys = await explorerKeys(
            connectionId,
            db,
            node.schema,
            node.tableName
          );
          for (const k of keys) {
            children.push({
              id: makeNodeId(
                connectionId,
                "db",
                db,
                "key",
                node.schema,
                node.tableName,
                k.name
              ),
              connectionId,
              type: "key",
              name: k.name,
              label: `${k.name} (${k.type})`,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
        case "table-indexes": {
          if (!node.schema) {
            console.error(`Expected schema on node ${node.id} but it was undefined`);
            return children;
          }
          if (!node.tableName) {
            console.error(`Expected tableName on node ${node.id} but it was undefined`);
            return children;
          }
          const indexes = await explorerIndexes(
            connectionId,
            db,
            node.schema,
            node.tableName
          );
          for (const idx of indexes) {
            children.push({
              id: makeNodeId(
                connectionId,
                "db",
                db,
                "idx",
                node.schema,
                node.tableName,
                idx.name
              ),
              connectionId,
              type: "index",
              name: idx.name,
              label: `${idx.name} (${idx.type})`,
              database: db,
              expanded: false,
              loading: false,
              loaded: false,
              children: [],
              parentId: node.id,
              hasChildren: false,
            });
          }
          break;
        }
      }
      break;
    }

    case "table": {
      if (!node.database) {
        console.error(`Expected database on node ${node.id} but it was undefined`);
        return children;
      }
      if (!node.schema) {
        console.error(`Expected schema on node ${node.id} but it was undefined`);
        return children;
      }
      const db = node.database;
      const schema = node.schema;
      const tableName = node.name;

      // Columns folder
      children.push({
        id: makeNodeId(connectionId, "db", db, "table-columns", schema, tableName),
        connectionId,
        type: "folder",
        name: "Columns",
        database: db,
        schema,
        tableName,
        expanded: false,
        loading: false,
        loaded: false,
        children: [],
        parentId: node.id,
        hasChildren: true,
        folderKind: "table-columns",
      });

      // Keys folder
      children.push({
        id: makeNodeId(connectionId, "db", db, "table-keys", schema, tableName),
        connectionId,
        type: "folder",
        name: "Keys",
        database: db,
        schema,
        tableName,
        expanded: false,
        loading: false,
        loaded: false,
        children: [],
        parentId: node.id,
        hasChildren: true,
        folderKind: "table-keys",
      });

      // Indexes folder
      children.push({
        id: makeNodeId(connectionId, "db", db, "table-indexes", schema, tableName),
        connectionId,
        type: "folder",
        name: "Indexes",
        database: db,
        schema,
        tableName,
        expanded: false,
        loading: false,
        loaded: false,
        children: [],
        parentId: node.id,
        hasChildren: true,
        folderKind: "table-indexes",
      });
      break;
    }

    case "view": {
      if (!node.database) {
        console.error(`Expected database on node ${node.id} but it was undefined`);
        return children;
      }
      if (!node.schema) {
        console.error(`Expected schema on node ${node.id} but it was undefined`);
        return children;
      }
      const db = node.database;
      const schema = node.schema;
      const viewName = node.name;

      // Columns folder for views
      children.push({
        id: makeNodeId(connectionId, "db", db, "view-columns", schema, viewName),
        connectionId,
        type: "folder",
        name: "Columns",
        database: db,
        schema,
        tableName: viewName,
        expanded: false,
        loading: false,
        loaded: false,
        children: [],
        parentId: node.id,
        hasChildren: true,
        folderKind: "table-columns",
      });
      break;
    }

    default:
      break;
  }

  return children;
}
