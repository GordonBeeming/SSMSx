import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import Editor from "@monaco-editor/react";
import { Code2, Database, FileCode2, RefreshCw, X } from "lucide-react";
import { explorerDatabaseDiagram } from "../../explorer/api/explorerApi";
import type {
  DatabaseDiagramInfo,
  DiagramColumnInfo,
  DiagramTableInfo,
} from "../../explorer/types";
import {
  generateEfCoreScaffold,
  generateSqlDiagramScript,
} from "../utils/generators";
import {
  createEmptyDiagramView,
  loadSavedDiagramViews,
  saveDiagramViews,
  type SavedDiagramView,
} from "../utils/savedDiagrams";
import type { LayoutMode } from "../types";
import { useQueryStore } from "../../query";
import { useAppEditorTheme } from "../../../shared/hooks/useAppEditorTheme";

interface DatabaseDiagramWorkspaceProps {
  connectionId: string;
  database: string;
  diagramViewId?: string;
  initialName?: string;
  onTitleChange?: (title: string) => void;
  onClose: () => void;
}

type DiagramMode = "diagram" | "sql" | "ef";

const NODE_WIDTH = 280;
const NODE_MIN_HEIGHT = 140;
const GRID_X_GAP = 90;
const GRID_Y_GAP = 90;
const INITIAL_FOCUS_NODE_COUNT = 6;
const MAX_VISIBLE_COLUMNS = 12;
const ROW_HEIGHT = 44;
const TABLE_HEADER_HEIGHT = 74;

interface ColumnEndpoint {
  source: boolean;
  target: boolean;
}

interface TableNodeData extends Record<string, unknown> {
  table: DiagramTableInfo;
  endpoints: Record<string, ColumnEndpoint>;
}

const nodeTypes = {
  table: TableNode,
};

function tableKey(table: Pick<DiagramTableInfo, "schema" | "name">): string {
  return `${table.schema}.${table.name}`;
}

function columnHandleId(kind: "source" | "target", columnName: string): string {
  return `${kind}:${encodeURIComponent(columnName)}`;
}

function visibleColumnsForTable(
  table: DiagramTableInfo,
  endpoints: Record<string, ColumnEndpoint>
): DiagramColumnInfo[] {
  const endpointColumns = new Set(Object.keys(endpoints));
  const initialColumns = table.columns.slice(0, MAX_VISIBLE_COLUMNS);
  return [
    ...initialColumns,
    ...table.columns.filter(
      (column) =>
        endpointColumns.has(column.name) &&
        !initialColumns.some((visibleColumn) => visibleColumn.name === column.name)
    ),
  ];
}

function TableNode({ data }: { data: TableNodeData }) {
  return <TableCard table={data.table} endpoints={data.endpoints} />;
}

function TableCard({
  table,
  endpoints,
}: {
  table: DiagramTableInfo;
  endpoints: Record<string, ColumnEndpoint>;
}) {
  const visibleColumns = visibleColumnsForTable(table, endpoints);
  const hiddenCount = table.columns.length - visibleColumns.length;

  return (
    <div className="w-[280px] overflow-hidden rounded border border-bg-tertiary bg-bg-input text-left shadow-sm">
      <div className="border-b border-bg-tertiary bg-bg-secondary px-3 py-2">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-accent" />
          <div className="min-w-0">
            <div className="truncate text-xs text-text-secondary">{table.schema}</div>
            <div className="truncate text-sm font-semibold text-text-primary">
              {table.name}
            </div>
          </div>
        </div>
        <div className="mt-1 text-[11px] text-text-secondary">
          {table.rowCount.toLocaleString()} rows
        </div>
      </div>
      <div className="px-2 py-1">
        {visibleColumns.map((column) => (
          <ColumnRow
            key={column.name}
            column={column}
            endpoint={endpoints[column.name] ?? { source: false, target: false }}
          />
        ))}
        {hiddenCount > 0 && (
          <div className="px-1 py-1 text-[11px] text-text-secondary">
            + {hiddenCount} more columns
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnRow({
  column,
  endpoint,
}: {
  column: DiagramColumnInfo;
  endpoint: ColumnEndpoint;
}) {
  const tags = [
    column.isPrimaryKey ? "PK" : null,
    column.isForeignKey ? "FK" : null,
    column.isIdentity ? "IDENTITY" : null,
  ].filter(Boolean);
  const defaultText = column.defaultDefinition
    ? trimDefaultDefinition(column.defaultDefinition)
    : null;

  return (
    <div className="relative border-b border-bg-secondary px-1 py-1.5 last:border-0">
      {endpoint.target && (
        <Handle
          id={columnHandleId("target", column.name)}
          type="target"
          position={Position.Left}
          className="!left-0 !h-2 !w-2 !translate-x-0 !border-bg-input !bg-accent"
          title={`Referenced column: ${column.name}`}
        />
      )}
      {endpoint.source && (
        <Handle
          id={columnHandleId("source", column.name)}
          type="source"
          position={Position.Right}
          className="!right-0 !h-2 !w-2 !translate-x-0 !border-bg-input !bg-accent"
          title={`Foreign key column: ${column.name}`}
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(86px,auto)] items-center gap-2">
        <span className="truncate text-xs text-text-primary" title={column.name}>
          {column.name}
        </span>
        <span className="truncate text-right text-[11px] text-text-secondary" title={column.dataType}>
          {column.dataType}
        </span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent"
          >
            {tag}
          </span>
        ))}
        {column.isNullable && !column.isPrimaryKey && (
          <span
            className="rounded bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-warning"
            title="Column allows NULL values"
          >
            Nullable
          </span>
        )}
        {defaultText && (
          <span
            className="min-w-0 max-w-full truncate rounded bg-bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary"
            title={`Default: ${defaultText}`}
          >
            Default: {defaultText}
          </span>
        )}
      </div>
    </div>
  );
}

function trimDefaultDefinition(value: string): string {
  let result = value.trim();
  while (result.startsWith("(") && result.endsWith(")") && result.length > 2) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function buildEndpointMap(diagram: DatabaseDiagramInfo): Map<string, Record<string, ColumnEndpoint>> {
  const endpoints = new Map<string, Record<string, ColumnEndpoint>>();

  const ensureColumn = (tableId: string, columnName: string): ColumnEndpoint => {
    const tableEndpoints = endpoints.get(tableId) ?? {};
    endpoints.set(tableId, tableEndpoints);
    tableEndpoints[columnName] ??= { source: false, target: false };
    return tableEndpoints[columnName];
  };

  for (const relationship of diagram.relationships) {
    const sourceTable = `${relationship.fromSchema}.${relationship.fromTable}`;
    const targetTable = `${relationship.toSchema}.${relationship.toTable}`;

    for (const columnName of relationship.fromColumns) {
      ensureColumn(sourceTable, columnName).source = true;
    }
    for (const columnName of relationship.toColumns) {
      ensureColumn(targetTable, columnName).target = true;
    }
  }

  return endpoints;
}

function layoutGraph(
  diagram: DatabaseDiagramInfo,
  layoutMode: LayoutMode,
  manualPositions: Record<string, { x: number; y: number }>
): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: layoutMode === "tb" ? "TB" : "LR",
    nodesep: layoutMode === "tb" ? 56 : 70,
    ranksep: layoutMode === "tb" ? 92 : 110,
  });

  const endpointMap = buildEndpointMap(diagram);
  const visibleColumnNamesByTable = new Map<string, Set<string>>();
  const nodes = diagram.tables.map((table) => {
    const id = tableKey(table);
    const visibleColumns = visibleColumnsForTable(table, endpointMap.get(id) ?? {});
    const visibleColumnNames = new Set(visibleColumns.map((column) => column.name));
    visibleColumnNamesByTable.set(id, visibleColumnNames);
    const height = Math.max(NODE_MIN_HEIGHT, TABLE_HEADER_HEIGHT + visibleColumns.length * ROW_HEIGHT);
    graph.setNode(id, { width: NODE_WIDTH, height });
    return {
      id,
      type: "table",
      data: {
        table,
        endpoints: endpointMap.get(id) ?? {},
      },
      position: { x: 0, y: 0 },
      draggable: true,
      style: {
        width: NODE_WIDTH,
        border: "none",
        padding: 0,
        background: "transparent",
      },
    } satisfies Node;
  });

  const tableKeys = new Set(diagram.tables.map(tableKey));
  const edges = diagram.relationships.flatMap((relationship) => {
    const source = `${relationship.fromSchema}.${relationship.fromTable}`;
    const target = `${relationship.toSchema}.${relationship.toTable}`;
    if (!tableKeys.has(source) || !tableKeys.has(target)) {
      return [];
    }

    graph.setEdge(source, target);
    return relationship.fromColumns.flatMap((fromColumn, index): Edge[] => {
      const toColumn = relationship.toColumns[index] ?? relationship.toColumns[0];
      if (
        !toColumn ||
        !visibleColumnNamesByTable.get(source)?.has(fromColumn) ||
        !visibleColumnNamesByTable.get(target)?.has(toColumn)
      ) {
        return [];
      }

      return [{
        id: `${relationship.name}:${index}`,
        source,
        target,
        sourceHandle: columnHandleId("source", fromColumn),
        targetHandle: columnHandleId("target", toColumn),
        label: relationship.fromColumns.length > 1 && index === 0 ? relationship.name : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        type: "smoothstep",
        style: { stroke: "#0063B2", strokeWidth: 1.5 },
        labelStyle: { fontSize: 11, fill: "#374151" },
      }];
    });
  });

  if (layoutMode !== "grid") {
    dagre.layout(graph);
  }

  return {
    nodes: nodes.map((node, index) => {
      const graphPosition = layoutMode === "grid" ? null : graph.node(node.id);
      const rowLength = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
      const row = Math.floor(index / rowLength);
      const column = index % rowLength;
      const autoPosition = graphPosition
        ? {
            x: graphPosition.x - NODE_WIDTH / 2,
            y: graphPosition.y - (graphPosition.height ?? NODE_MIN_HEIGHT) / 2,
          }
        : {
            x: column * (NODE_WIDTH + GRID_X_GAP),
            y: row * (NODE_MIN_HEIGHT + GRID_Y_GAP),
          };

      return {
        ...node,
        position: manualPositions[node.id] ?? autoPosition,
      };
    }),
    edges,
  };
}

function getInitialFocusNodeIds(diagram: DatabaseDiagramInfo): string[] {
  const degree = new Map<string, number>();
  const neighbors = new Map<string, Set<string>>();

  for (const table of diagram.tables) {
    const key = tableKey(table);
    degree.set(key, 0);
    neighbors.set(key, new Set());
  }

  for (const relationship of diagram.relationships) {
    const source = `${relationship.fromSchema}.${relationship.fromTable}`;
    const target = `${relationship.toSchema}.${relationship.toTable}`;
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
    neighbors.get(source)?.add(target);
    neighbors.get(target)?.add(source);
  }

  const [focusNode] = [...degree.entries()].sort((a, b) => b[1] - a[1]);
  if (!focusNode) {
    return diagram.tables.slice(0, INITIAL_FOCUS_NODE_COUNT).map(tableKey);
  }

  const related = [...(neighbors.get(focusNode[0]) ?? [])]
    .sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0))
    .slice(0, INITIAL_FOCUS_NODE_COUNT - 1);

  return [focusNode[0], ...related];
}

function getInitialDiagramView(
  diagramViewId: string | undefined,
  storedViews: SavedDiagramView[],
  loadedDiagram: DatabaseDiagramInfo,
  initialName: string | undefined
): { view: SavedDiagramView; isNewRequestedView: boolean } {
  const requestedView = diagramViewId
    ? storedViews.find((view) => view.id === diagramViewId)
    : null;
  if (requestedView) {
    return { view: requestedView, isNewRequestedView: false };
  }

  if (diagramViewId) {
    const emptyView = createEmptyDiagramView(storedViews, diagramViewId);
    return {
      view: {
        ...emptyView,
        name: initialName || emptyView.name,
      },
      isNewRequestedView: true,
    };
  }

  const existingView = storedViews[0];
  if (existingView) {
    return { view: existingView, isNewRequestedView: false };
  }

  return {
    view: {
      id: crypto.randomUUID(),
      name: initialName || "Diagram 1",
      selectedTableKeys: getInitialFocusNodeIds(loadedDiagram),
      layoutMode: "lr",
      manualPositions: {},
      tableListCollapsed: false,
    },
    isNewRequestedView: false,
  };
}

export function DatabaseDiagramWorkspace({
  connectionId,
  database,
  diagramViewId,
  initialName,
  onTitleChange,
  onClose,
}: DatabaseDiagramWorkspaceProps) {
  const [diagram, setDiagram] = useState<DatabaseDiagramInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DiagramMode>("diagram");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("lr");
  const [tableSearch, setTableSearch] = useState("");
  const [savedViews, setSavedViews] = useState<SavedDiagramView[]>([]);
  const [activeViewId, setActiveViewId] = useState("");
  const [diagramName, setDiagramName] = useState("Diagram 1");
  const [isDirty, setIsDirty] = useState(false);
  const [tableListCollapsed, setTableListCollapsed] = useState(false);
  const [selectedTableKeys, setSelectedTableKeys] = useState<Set<string>>(new Set());
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [namespace, setNamespace] = useState("Ssmsx.Domain");
  const [dbContextName, setDbContextName] = useState(`${database.replace(/\W+/g, "")}DbContext`);
  const addTab = useQueryStore((state) => state.addTab);

  const loadDiagram = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await explorerDatabaseDiagram(connectionId, database);
      const storedViews = loadSavedDiagramViews(connectionId, database);
      const { view: initialView, isNewRequestedView } = getInitialDiagramView(
        diagramViewId,
        storedViews,
        loaded,
        initialName
      );

      setDiagram(loaded);
      setSavedViews(storedViews.length > 0 ? storedViews : [initialView]);
      setActiveViewId(initialView.id);
      setDiagramName(initialView.name);
      onTitleChange?.(initialView.name);
      setSelectedTableKeys(new Set(initialView.selectedTableKeys));
      setLayoutMode(initialView.layoutMode);
      setManualPositions(initialView.manualPositions);
      setTableListCollapsed(initialView.tableListCollapsed);
      setIsDirty(isNewRequestedView);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDiagram();
  }, [connectionId, database, diagramViewId]);

  const selectedKeys = useMemo(
    () => [...selectedTableKeys].sort(),
    [selectedTableKeys]
  );
  const selectedKeysKey = selectedKeys.join("|");
  const visibleDiagram = useMemo(() => {
    if (!diagram) {
      return null;
    }

    const tables = diagram.tables.filter((table) => selectedTableKeys.has(tableKey(table)));
    const tableKeys = new Set(tables.map(tableKey));
    return {
      ...diagram,
      tables,
      relationships: diagram.relationships.filter((relationship) =>
        tableKeys.has(`${relationship.fromSchema}.${relationship.fromTable}`) &&
        tableKeys.has(`${relationship.toSchema}.${relationship.toTable}`)
      ),
    };
  }, [diagram, selectedTableKeys]);
  const graph = useMemo(
    () => (visibleDiagram ? layoutGraph(visibleDiagram, layoutMode, manualPositions) : null),
    [visibleDiagram, layoutMode, manualPositions]
  );
  const sqlOutput = useMemo(
    () => (visibleDiagram ? generateSqlDiagramScript(visibleDiagram) : ""),
    [visibleDiagram]
  );
  const efOutput = useMemo(
    () =>
      visibleDiagram
        ? generateEfCoreScaffold(visibleDiagram, { namespace, dbContextName })
        : "",
    [visibleDiagram, namespace, dbContextName]
  );
  const filteredTables = useMemo(() => {
    if (!diagram) {
      return [];
    }

    const search = tableSearch.trim().toLowerCase();
    return diagram.tables.filter((table) => {
      const label = `${table.schema}.${table.name}`.toLowerCase();
      return !search || label.includes(search);
    });
  }, [diagram, tableSearch]);

  const currentView = (): SavedDiagramView => ({
    id: activeViewId || crypto.randomUUID(),
    name: diagramName.trim() || "Untitled diagram",
    selectedTableKeys: [...selectedTableKeys].sort(),
    layoutMode,
    manualPositions,
    tableListCollapsed,
  });

  const saveCurrentView = () => {
    const view = currentView();
    const nextViews = [
      ...savedViews.filter((savedView) => savedView.id !== view.id),
      view,
    ];
    setSavedViews(nextViews);
    setActiveViewId(view.id);
    saveDiagramViews(connectionId, database, nextViews);
    onTitleChange?.(view.name);
    setIsDirty(false);
  };

  useEffect(() => {
    setNodes(graph?.nodes ?? []);
    setEdges(graph?.edges ?? []);
  }, [graph]);

  useEffect(() => {
    if (!flow || nodes.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      flow.fitView({ padding: 0.2, minZoom: 0.45, maxZoom: 1 });
    });
  }, [flow, layoutMode, selectedKeysKey]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback((_, node) => {
    setManualPositions((current) => ({
      ...current,
      [node.id]: node.position,
    }));
    setIsDirty(true);
  }, []);

  const setAutoLayout = (nextLayout: LayoutMode) => {
    setLayoutMode(nextLayout);
    setManualPositions({});
    setIsDirty(true);
  };

  const selectTables = (keys: string[]) => {
    setSelectedTableKeys(new Set(keys));
    setManualPositions({});
    setIsDirty(true);
  };

  const toggleTable = (key: string) => {
    setSelectedTableKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      setIsDirty(true);
      return next;
    });
  };

  const selectFocusedTables = () => {
    if (!diagram) {
      return;
    }
    selectTables(getInitialFocusNodeIds(diagram));
  };

  const selectFilteredTables = () => {
    selectTables(filteredTables.map(tableKey));
  };

  const addFilteredTables = () => {
    setSelectedTableKeys((current) => {
      const next = new Set(current);
      for (const table of filteredTables) {
        next.add(tableKey(table));
      }
      return next;
    });
    setManualPositions({});
    setIsDirty(true);
  };

  const clearFilteredTables = () => {
    const filteredKeys = new Set(filteredTables.map(tableKey));
    setSelectedTableKeys((current) => {
      const next = new Set(current);
      for (const key of filteredKeys) {
        next.delete(key);
      }
      return next;
    });
    setManualPositions({});
    setIsDirty(true);
  };

  const toggleTableList = () => {
    setTableListCollapsed((current) => !current);
    setIsDirty(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-primary">
      <div className="flex items-center gap-3 border-b border-bg-tertiary bg-bg-secondary px-4 py-2">
        <Database size={16} className="text-accent" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-primary">
            {database} Database Diagram
          </div>
          <div className="text-xs text-text-secondary">
            {diagram
              ? `${visibleDiagram?.tables.length ?? 0} of ${diagram.tables.length} tables, ${visibleDiagram?.relationships.length ?? 0} relationships`
              : "Loading schema"}
          </div>
        </div>
        <div className="flex-1" />
        <input
          value={diagramName}
          onChange={(event) => {
            setDiagramName(event.target.value);
            onTitleChange?.(event.target.value.trim() || "Untitled diagram");
            setIsDirty(true);
          }}
          className="w-40 rounded border border-bg-tertiary bg-bg-primary px-2 py-1 text-xs text-text-primary focus:border-accent-hover focus:outline-none"
          aria-label="Diagram name"
        />
        <button
          onClick={saveCurrentView}
          className={`rounded px-3 py-1 text-xs ${
            isDirty
              ? "bg-accent text-accent-text hover:bg-accent-hover"
              : "border border-bg-tertiary bg-bg-primary text-text-secondary hover:text-text-primary"
          }`}
        >
          {isDirty ? "Save*" : "Saved"}
        </button>
        <button
          onClick={() => setMode("diagram")}
          className={`rounded px-3 py-1 text-sm ${
            mode === "diagram" ? "bg-accent text-accent-text" : "bg-bg-primary text-text-primary"
          }`}
        >
          Diagram
        </button>
        <button
          onClick={() => setMode("sql")}
          className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
            mode === "sql" ? "bg-accent text-accent-text" : "bg-bg-primary text-text-primary"
          }`}
        >
          <Code2 size={14} />
          SQL
        </button>
        <button
          onClick={() => setMode("ef")}
          className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
            mode === "ef" ? "bg-accent text-accent-text" : "bg-bg-primary text-text-primary"
          }`}
        >
          <FileCode2 size={14} />
          EF Core
        </button>
        <button
          onClick={loadDiagram}
          className="rounded border border-bg-tertiary bg-bg-primary p-1.5 text-text-secondary hover:text-text-primary"
          title="Refresh diagram"
        >
          <RefreshCw size={16} />
        </button>
        <button
          onClick={onClose}
          className="rounded border border-bg-tertiary bg-bg-primary p-1.5 text-text-secondary hover:text-text-primary"
          title="Close diagram"
        >
          <X size={16} />
        </button>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
          Loading database diagram...
        </div>
      )}

      {!loading && error && (
        <div className="m-4 rounded border border-error bg-bg-input p-3 text-sm text-error">
          {error}
        </div>
      )}

      {!loading && !error && diagram && mode === "diagram" && (
        <div className="flex min-h-0 flex-1">
          <div
            className={`flex min-w-0 flex-col border-r border-bg-tertiary bg-bg-secondary ${
              tableListCollapsed ? "w-11" : "w-80 min-w-72"
            }`}
          >
            {tableListCollapsed ? (
              <button
                onClick={toggleTableList}
                className="m-2 flex h-24 items-center justify-center rounded border border-bg-tertiary bg-bg-input text-xs text-text-primary hover:bg-bg-primary"
                title="Show table list"
              >
                <span className="-rotate-90 whitespace-nowrap">Tables</span>
              </button>
            ) : (
              <>
            <div className="border-b border-bg-tertiary p-3">
              <div className="flex items-center gap-2">
                <input
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Filter tables..."
                  className="min-w-0 flex-1 rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
                />
                <select
                  value={layoutMode}
                  onChange={(event) => setAutoLayout(event.target.value as LayoutMode)}
                  className="w-28 rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 text-xs text-text-primary focus:border-accent-hover focus:outline-none"
                  title="Auto layout"
                >
                  <option value="lr">Left-right</option>
                  <option value="tb">Top-down</option>
                  <option value="grid">Grid</option>
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={toggleTableList}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary"
                >
                  Collapse
                </button>
                <button
                  onClick={selectFocusedTables}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary"
                >
                  Focus
                </button>
                <button
                  onClick={() => selectTables(diagram.tables.map(tableKey))}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary"
                >
                  All
                </button>
                <button
                  onClick={selectFilteredTables}
                  disabled={filteredTables.length === 0}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Only filtered
                </button>
                <button
                  onClick={addFilteredTables}
                  disabled={filteredTables.length === 0}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add filtered
                </button>
                <button
                  onClick={() => selectTables([])}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary"
                >
                  Clear
                </button>
                <button
                  onClick={clearFilteredTables}
                  disabled={filteredTables.length === 0}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear filtered
                </button>
                <button
                  onClick={() => {
                    setManualPositions({});
                    setIsDirty(true);
                  }}
                  className="rounded border border-bg-tertiary bg-bg-input px-2 py-1 text-[11px] text-text-primary hover:bg-bg-primary"
                >
                  Reset layout
                </button>
              </div>
              <div className="mt-2 text-[11px] text-text-secondary">
                {visibleDiagram?.tables.length ?? 0} selected. Drag tables on the canvas to adjust placement.
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredTables.map((table) => {
                const key = tableKey(table);
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-text-primary hover:bg-bg-primary"
                    title={key}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTableKeys.has(key)}
                      onChange={() => toggleTable(key)}
                      className="accent-accent-hover"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-text-secondary">{table.schema}.</span>
                      {table.name}
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      {table.columns.length}
                    </span>
                  </label>
                );
              })}
            </div>
              </>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                Select one or more tables to show the diagram.
              </div>
            ) : (
          <ReactFlow
            key={`${layoutMode}:${selectedKeysKey}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setFlow}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            fitView
            fitViewOptions={{
              padding: 0.2,
              minZoom: 0.45,
              maxZoom: 1,
            }}
            minZoom={0.2}
            maxZoom={1.5}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
            )}
          </div>
        </div>
      )}

      {!loading && !error && visibleDiagram && mode === "sql" && (
        <CodeOutput
          title="SQL diagram output"
          language="sql"
          value={sqlOutput}
          actionLabel="Open in Query"
          onAction={() => {
            addTab({
              id: crypto.randomUUID(),
              connectionId,
              database,
              initialSql: sqlOutput,
              title: `${database} diagram SQL`,
            });
            onClose();
          }}
        />
      )}

      {!loading && !error && visibleDiagram && mode === "ef" && (
        <div className="flex min-h-0 flex-1">
          <div className="w-72 border-r border-bg-tertiary bg-bg-secondary p-3">
            <label className="block text-xs font-semibold text-text-secondary">
              Namespace
              <input
                value={namespace}
                onChange={(event) => setNamespace(event.target.value)}
                className="mt-1 w-full rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 text-sm text-text-primary"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-text-secondary">
              DbContext
              <input
                value={dbContextName}
                onChange={(event) => setDbContextName(event.target.value)}
                className="mt-1 w-full rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 text-sm text-text-primary"
              />
            </label>
          </div>
          <CodeOutput
            title="EF Core split configuration output"
            language="csharp"
            value={efOutput}
          />
        </div>
      )}
    </div>
  );
}

function CodeOutput({
  title,
  language,
  value,
  actionLabel,
  onAction,
}: {
  title: string;
  language: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useAppEditorTheme();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-bg-tertiary bg-bg-secondary px-4 py-2">
        <div className="text-xs font-semibold uppercase text-text-secondary">{title}</div>
        <div className="flex-1" />
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="rounded bg-accent px-3 py-1 text-xs text-accent-text hover:bg-accent-hover"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <Editor
        language={language}
        theme={theme}
        value={value}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderWhitespace: "none",
          tabSize: 4,
          insertSpaces: true,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
