import React from "react";

export type AuthType = "SqlAuth" | "ConnectionString" | "EntraMfa";

export interface ConnectionItemProps {
  /** Optional display alias (falls back to serverName). */
  alias?: string;
  /** SQL Server host/instance. */
  serverName: string;
  /** Default database. */
  database?: string;
  /** Login username. */
  username?: string;
  /** Authentication type — drives the chip label. @default "SqlAuth" */
  authType?: AuthType;
  /** Required connection-profile background colour. */
  profileBackground: string;
  /** Required connection-profile foreground colour. */
  profileForeground: string;
  /** Selected state. @default false */
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * A saved-connection row — profile marker, alias/server detail, auth-type chip.
 *
 * @startingPoint section="Connections" subtitle="Saved connection list rows" viewport="360x220"
 */
export function ConnectionItem(props: ConnectionItemProps): React.ReactElement;
