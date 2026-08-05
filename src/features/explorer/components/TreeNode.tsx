import type { CSSProperties } from "react";
import type { ConnectionInfo } from "../../connection";
import type { ColorProfile } from "../../settings/types";
import type { ExplorerNode } from "../types";
import { useExplorerStore } from "../store/explorerStore";
import { NodeIcon } from "./NodeIcon";
import { getEffectiveAlias } from "../../../shared/connectionAppearance";

interface TreeNodeProps {
  node: ExplorerNode;
  depth: number;
  connection?: ConnectionInfo;
  profile?: ColorProfile;
  onContextMenu: (e: React.MouseEvent, node: ExplorerNode) => void;
}

interface TreeNodeStyle extends CSSProperties {
  "--object-explorer-row-background"?: string;
  "--object-explorer-row-foreground"?: string;
}

export function TreeNode({
  node,
  depth,
  connection,
  profile,
  onContextMenu,
}: TreeNodeProps) {
  const { selectedNodeId, selectNode, toggleExpand } = useExplorerStore();
  const isSelected = selectedNodeId === node.id;
  const label = node.type === "server" && connection ? getEffectiveAlias(connection) : node.label || node.name;
  const rowStyle: TreeNodeStyle = {
    paddingLeft: `${depth * 16 + 4}px`,
    "--object-explorer-row-background": profile?.background,
    "--object-explorer-row-foreground": profile?.foreground,
  };

  return (
    <div
      className={`flex cursor-pointer items-center gap-1 py-0.5 pr-2 text-sm ${
        profile
          ? "object-explorer-profiled-row"
          : isSelected
          ? "bg-accent/15 text-text-primary"
          : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
      }`}
      style={rowStyle}
      onClick={() => selectNode(node.id)}
      onDoubleClick={() => {
        if (node.hasChildren) toggleExpand(node.id);
        if (node.type === "diagram" && node.database && node.diagramViewId) {
          window.dispatchEvent(
            new CustomEvent("diagram:open", {
              detail: {
                connectionId: node.connectionId,
                database: node.database,
                diagramViewId: node.diagramViewId,
                title: node.name,
              },
            })
          );
        }
      }}
      onContextMenu={(e) => onContextMenu(e, node)}
      role="treeitem"
      aria-expanded={node.hasChildren ? node.expanded : undefined}
      aria-selected={isSelected}
    >
      {/* Expand/collapse chevron or spinner */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {node.loading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
        ) : node.hasChildren ? (
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
          >
            <svg
              className={`h-3 w-3 transition-transform ${node.expanded ? "rotate-90" : ""}`}
              viewBox="0 0 8 8"
              fill="currentColor"
            >
              <path d="M2 1l4 3-4 3z" />
            </svg>
          </button>
        ) : null}
      </span>

      {/* Node icon */}
      <NodeIcon type={node.type} folderKind={node.folderKind} />

      {/* Node label */}
      <span className="truncate">{label}</span>
    </div>
  );
}
