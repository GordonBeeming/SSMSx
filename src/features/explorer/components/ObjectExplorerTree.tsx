import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useExplorerStore } from "../store/explorerStore";
import type { ExplorerNode } from "../types";
import { TreeNode } from "./TreeNode";
import { useTreeKeyboard } from "../hooks/useTreeKeyboard";
import { useExplorerContextMenu } from "../hooks/useExplorerContextMenu";
import { ContextMenu } from "../../../shared/components/ContextMenu";
import { useSettingsStore } from "../../settings";

const EXPLORER_WIDTH_STORAGE_KEY = "ssmsx.objectExplorer.width";
const DEFAULT_EXPLORER_WIDTH = 260;
const MIN_EXPLORER_WIDTH = 180;
const MAX_EXPLORER_WIDTH = 720;

function clampExplorerWidth(value: number): number {
  return Math.min(MAX_EXPLORER_WIDTH, Math.max(MIN_EXPLORER_WIDTH, value));
}

function loadExplorerWidth(): number {
  try {
    const storedValue = window.localStorage.getItem(EXPLORER_WIDTH_STORAGE_KEY);
    if (!storedValue) return DEFAULT_EXPLORER_WIDTH;

    const parsedValue = Number(storedValue);
    return Number.isFinite(parsedValue)
      ? clampExplorerWidth(parsedValue)
      : DEFAULT_EXPLORER_WIDTH;
  } catch {
    return DEFAULT_EXPLORER_WIDTH;
  }
}

function saveExplorerWidth(value: number): void {
  try {
    window.localStorage.setItem(EXPLORER_WIDTH_STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures; resizing should still work for the session.
  }
}

export function ObjectExplorerTree() {
  // Subscribe to the state that getVisibleNodes depends on
  const nodes = useExplorerStore((s) => s.nodes);
  const rootNodeIds = useExplorerStore((s) => s.rootNodeIds);
  const getVisibleNodes = useExplorerStore((s) => s.getVisibleNodes);
  const refreshNode = useExplorerStore((s) => s.refreshNode);
  const refreshLoadedTableFolders = useExplorerStore((s) => s.refreshLoadedTableFolders);
  const groupTablesBySchema = useSettingsStore(
    (s) => s.settings.explorer.groupTablesBySchema
  );
  const visibleNodes = useMemo(() => getVisibleNodes(), [nodes, rootNodeIds, getVisibleNodes]);
  const parentRef = useRef<HTMLDivElement>(null);
  const previousGroupTablesBySchemaRef = useRef(groupTablesBySchema);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_EXPLORER_WIDTH);
  const handleKeyDown = useTreeKeyboard(visibleNodes);
  const getMenuItems = useExplorerContextMenu();
  const [explorerWidth, setExplorerWidth] = useState(loadExplorerWidth);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: ExplorerNode;
  } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        connectionId: string;
        database: string;
      }>).detail;
      if (!detail?.connectionId || !detail.database) {
        return;
      }

      const diagramsFolder = Object.values(useExplorerStore.getState().nodes).find(
        (node) =>
          node.connectionId === detail.connectionId &&
          node.database === detail.database &&
          node.type === "folder" &&
          node.folderKind === "diagrams" &&
          node.loaded
      );
      if (diagramsFolder) {
        void refreshNode(diagramsFolder.id);
      }
    };
    window.addEventListener("diagram:views-changed", handler);
    return () => window.removeEventListener("diagram:views-changed", handler);
  }, [refreshNode]);

  useEffect(() => {
    if (previousGroupTablesBySchemaRef.current === groupTablesBySchema) {
      return;
    }

    previousGroupTablesBySchemaRef.current = groupTablesBySchema;
    void refreshLoadedTableFolders();
  }, [groupTablesBySchema, refreshLoadedTableFolders]);

  const virtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 10,
  });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: ExplorerNode) => {
      e.preventDefault();
      const items = getMenuItems(node);
      if (items.length > 0) {
        setContextMenu({ x: e.clientX, y: e.clientY, node });
      }
    },
    [getMenuItems]
  );

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      resizeStartXRef.current = event.clientX;
      resizeStartWidthRef.current = explorerWidth;

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampExplorerWidth(
          resizeStartWidthRef.current + moveEvent.clientX - resizeStartXRef.current
        );
        setExplorerWidth(nextWidth);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        const nextWidth = clampExplorerWidth(
          resizeStartWidthRef.current + upEvent.clientX - resizeStartXRef.current
        );
        setExplorerWidth(nextWidth);
        saveExplorerWidth(nextWidth);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      document.addEventListener("pointercancel", handlePointerUp);
    },
    [explorerWidth]
  );

  return (
    <div
      className="relative flex h-full flex-none flex-col border-r border-bg-tertiary"
      style={{ width: explorerWidth }}
    >
      <div className="border-b border-bg-tertiary px-3 py-1.5">
        <span className="text-xs font-semibold tracking-wide text-text-secondary">
          OBJECT EXPLORER
        </span>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-auto focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="tree"
      >
        {visibleNodes.length === 0 ? (
          <div className="p-3 text-xs text-text-secondary">
            No connections. Connect to a server to browse objects.
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const { node, depth } = visibleNodes[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <TreeNode
                    node={node}
                    depth={depth}
                    onContextMenu={handleContextMenu}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Resize Object Explorer"
        title="Resize Object Explorer"
        onPointerDown={handleResizePointerDown}
        className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 hover:bg-accent/15 focus:bg-accent/20 focus:outline-none"
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
