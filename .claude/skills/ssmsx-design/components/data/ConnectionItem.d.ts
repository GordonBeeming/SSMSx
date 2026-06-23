import React from "react";

export type AuthType = "SqlAuth" | "ConnectionString" | "EntraMfa";

export interface ConnectionItemProps {
  /** Display name (falls back to serverName). */
  name?: string;
  /** SQL Server host/instance. */
  serverName: string;
  /** Default database. */
  database?: string;
  /** Login username. */
  username?: string;
  /** Authentication type — drives the chip label. @default "SqlAuth" */
  authType?: AuthType;
  /** Connection color dot. @default neutral slate */
  color?: string;
  /** Selected state. @default false */
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * A saved-connection row — color dot, name, server detail, auth-type chip.
 *
 * @startingPoint section="Connections" subtitle="Saved connection list rows" viewport="360x220"
 */
export function ConnectionItem(props: ConnectionItemProps): React.ReactElement;
