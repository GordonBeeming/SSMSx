import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useExplorerStore } from "../store/explorerStore";
import type { ExplorerNode } from "../types";
import { TreeNode } from "./TreeNode";
import { useTreeKeyboard } from "../hooks/useTreeKeyboard";
import { useExplorerContextMenu } from "../hooks/useExplorerContextMenu";
import { ContextMenu } from "../../../shared/components/ContextMenu";

export function ObjectExplorerTree() {
  // Subscribe to the state that getVisibleNodes depends on
  const nodes = useExplorerStore((s) => s.nodes);
  const rootNodeIds = useExplorerStore((s) => s.rootNodeIds);
  const getVisibleNodes = useExplorerStore((s) => s.getVisibleNodes);
  const refreshNode = useExplorerStore((s) => s.refreshNode);
  const visibleNodes = useMemo(() => getVisibleNodes(), [nodes, rootNodeIds, getVisibleNodes]);
  const parentRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useTreeKeyboard(visibleNodes);
  const getMenuItems = useExplorerContextMenu();

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

  return (
    <div
      className="flex h-full flex-col border-r border-bg-tertiary"
      style={{ width: 260 }}
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
