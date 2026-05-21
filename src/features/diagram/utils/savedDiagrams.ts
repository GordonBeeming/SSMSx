import type { LayoutMode } from "../types";

export interface SavedDiagramView {
  id: string;
  name: string;
  selectedTableKeys: string[];
  layoutMode: LayoutMode;
  manualPositions: Record<string, { x: number; y: number }>;
  tableListCollapsed: boolean;
}

export function diagramStorageKey(connectionId: string, database: string): string {
  return `ssmsx.diagramViews.${connectionId}.${database}`;
}

export function loadSavedDiagramViews(connectionId: string, database: string): SavedDiagramView[] {
  try {
    const value = window.localStorage.getItem(diagramStorageKey(connectionId, database));
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value) as Partial<SavedDiagramView>[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((view) => typeof view.id === "string")
      .map((view, index) => ({
        id: view.id ?? crypto.randomUUID(),
        name: typeof view.name === "string" && view.name.trim()
          ? view.name
          : `Diagram ${index + 1}`,
        selectedTableKeys: Array.isArray(view.selectedTableKeys)
          ? view.selectedTableKeys.filter((key): key is string => typeof key === "string")
          : [],
        layoutMode: view.layoutMode === "tb" || view.layoutMode === "grid" ? view.layoutMode : "lr",
        manualPositions: view.manualPositions ?? {},
        tableListCollapsed: Boolean(view.tableListCollapsed),
      }));
  } catch {
    return [];
  }
}

export function saveDiagramViews(
  connectionId: string,
  database: string,
  views: SavedDiagramView[]
) {
  window.localStorage.setItem(diagramStorageKey(connectionId, database), JSON.stringify(views));
  window.dispatchEvent(
    new CustomEvent("diagram:views-changed", {
      detail: { connectionId, database },
    })
  );
}

export function nextDiagramName(views: SavedDiagramView[]): string {
  return `Diagram ${views.length + 1}`;
}

export function createEmptyDiagramView(
  views: SavedDiagramView[],
  id: string = crypto.randomUUID()
): SavedDiagramView {
  return {
    id,
    name: nextDiagramName(views),
    selectedTableKeys: [],
    layoutMode: "lr",
    manualPositions: {},
    tableListCollapsed: false,
  };
}
