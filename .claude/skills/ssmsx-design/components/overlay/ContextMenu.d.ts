import React from "react";

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuProps {
  /** Viewport x position (px). */
  x?: number;
  /** Viewport y position (px). */
  y?: number;
  /** Menu items, top to bottom. */
  items: ContextMenuItem[];
  /** Called on outside-click or after an item runs. */
  onClose?: () => void;
  style?: React.CSSProperties;
}

/** Floating right-click menu used across the explorer, connection list and tabs. */
export function ContextMenu(props: ContextMenuProps): React.ReactElement;
