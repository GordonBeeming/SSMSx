import React from "react";
import type { ExplorerNodeType } from "./NodeIcon";

export interface TreeRowProps {
  /** SQL object type (drives the icon). */
  type: ExplorerNodeType;
  /** Row label text. */
  label: string;
  /** Indentation depth (0 = root). @default 0 */
  depth?: number;
  /** Whether the node is expanded (rotates the chevron). @default false */
  expanded?: boolean;
  /** Whether the node has children (shows a chevron). @default false */
  hasChildren?: boolean;
  /** Show a loading spinner instead of the chevron. @default false */
  loading?: boolean;
  /** Selected state — accent tint. @default false */
  selected?: boolean;
  /** Connection color dot (server rows only). */
  color?: string;
  onToggle?: () => void;
  onSelect?: () => void;
  style?: React.CSSProperties;
}

/**
 * One row of the Object Explorer tree.
 *
 * @startingPoint section="Explorer" subtitle="Object Explorer tree rows" viewport="320x320"
 */
export function TreeRow(props: TreeRowProps): React.ReactElement;
