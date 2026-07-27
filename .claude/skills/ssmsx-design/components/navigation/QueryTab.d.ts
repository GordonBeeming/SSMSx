import React from "react";

export interface QueryTabProps {
  /** Tab title (e.g. "Query 1"). */
  title: string;
  /** Database name shown as a prefix. */
  database?: string;
  /** Tab kind. @default "query" */
  kind?: "query" | "diagram";
  /** Active (selected) tab. @default false */
  active?: boolean;
  /** Show the unsaved-changes dot. @default false */
  dirty?: boolean;
  /** Required connection-profile background colour. */
  profileBackground: string;
  /** Required connection-profile foreground colour and inactive marker. */
  profileForeground: string;
  /** Whether the tab is pinned into the first wrapping band. @default false */
  pinned?: boolean;
  onTogglePinned?: () => void;
  onSelect?: () => void;
  onClose?: () => void;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
}

/** One query tab — profile marker/pair, pin state, label, dirty marker, close. */
export function QueryTab(props: QueryTabProps): React.ReactElement;
