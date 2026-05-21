import type { LayoutMode } from "../types";

export interface SavedDiagramView {
  id: string;
  name: string;
  selectedTableKeys: string[];
  layoutMode: LayoutMode;
  manualPositions: Record<string, { x: number; y: number }>;
  tableListCollapsed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadManualPositions(value: unknown): Record<string, { x: number; y: number }> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, { x: number; y: number }] =>
        isRecord(entry[1]) &&
        typeof entry[1].x === "number" &&
        Number.isFinite(entry[1].x) &&
        typeof entry[1].y === "number" &&
        Number.isFinite(entry[1].y)
    )
  );
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

    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecord)
      .map((view, index) => ({
        id: typeof view.id === "string" && view.id.trim() ? view.id : crypto.randomUUID(),
        name: typeof view.name === "string" && view.name.trim()
          ? view.name
          : `Diagram ${index + 1}`,
        selectedTableKeys: Array.isArray(view.selectedTableKeys)
          ? view.selectedTableKeys.filter((key): key is string => typeof key === "string")
          : [],
        layoutMode: view.layoutMode === "tb" || view.layoutMode === "grid" ? view.layoutMode : "lr",
        manualPositions: loadManualPositions(view.manualPositions),
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
): boolean {
  try {
    window.localStorage.setItem(diagramStorageKey(connectionId, database), JSON.stringify(views));
    window.dispatchEvent(
      new CustomEvent("diagram:views-changed", {
        detail: { connectionId, database },
      })
    );
    return true;
  } catch (error) {
    console.error("Failed to save diagram views", error);
    return false;
  }
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
