import React from "react";
import { Badge } from "./Badge";

const AUTH_LABELS = { SqlAuth: "SQL", ConnectionString: "CS", EntraMfa: "Entra" };

/**
 * SSMSX ConnectionItem — a saved-connection row from the connection list.
 * Required colour profile, optional alias + server/database/user detail, and an auth-type chip.
 */
export function ConnectionItem({
  alias,
  serverName,
  database,
  username,
  authType = "SqlAuth",
  profileBackground,
  profileForeground,
  selected = false,
  onClick,
  onDoubleClick,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const bg = selected ? profileBackground : hover ? "var(--surface-raised)" : "transparent";
  const fg = selected ? profileForeground : "var(--text-primary)";
  const detail = [serverName, database && `/ ${database}`, username && `— ${username}`].filter(Boolean).join(" ");

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "var(--radius-sm)",
        background: bg,
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        ...style,
      }}
    >
      <span style={{ width: 3, alignSelf: "stretch", minHeight: 20, borderRadius: "var(--radius-full)", background: profileForeground, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {alias || serverName}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: selected ? profileForeground : "var(--text-secondary)", opacity: selected ? 0.82 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {detail}
        </div>
      </div>
      <Badge tone="neutral">{AUTH_LABELS[authType] || authType}</Badge>
    </div>
  );
}
