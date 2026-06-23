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
  /** Connection color dot. */
  color?: string;
  onSelect?: () => void;
  onClose?: () => void;
  style?: React.CSSProperties;
}

/** One tab in the query tab bar — connection dot, label, dirty marker, close. */
export function QueryTab(props: QueryTabProps): React.ReactElement;
