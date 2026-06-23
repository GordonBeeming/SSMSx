import React from "react";

export type ExplorerNodeType =
  | "server" | "database" | "folder" | "table" | "view" | "column"
  | "key" | "index" | "procedure" | "function" | "user" | "diagram";

export interface NodeIconProps {
  /** SQL object type to render. */
  type: ExplorerNodeType;
  /** Optional folder sub-kind (e.g. "programmability", "security"). */
  folderKind?: string;
  /** Pixel size. @default 16 */
  size?: number;
  style?: React.CSSProperties;
}

/** Object Explorer glyphs — one per SQL object type, drawn in currentColor. */
export function NodeIcon(props: NodeIconProps): React.ReactElement | null;
