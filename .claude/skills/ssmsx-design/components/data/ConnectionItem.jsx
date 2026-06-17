import React from "react";
import { Badge } from "./Badge";

const AUTH_LABELS = { SqlAuth: "SQL", ConnectionString: "CS", EntraMfa: "Entra" };

/**
 * SSMSX ConnectionItem — a saved-connection row from the connection list.
 * Color dot, name + server/database/user detail, and an auth-type chip.
 */
export function ConnectionItem({
  name,
  serverName,
  database,
  username,
  authType = "SqlAuth",
  color = "var(--conn-slate)",
  selected = false,
  onClick,
  onDoubleClick,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const bg = selected || hover ? "var(--surface-raised)" : "transparent";
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
      <span style={{ width: 12, height: 12, borderRadius: "var(--radius-full)", background: color, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name || serverName}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {detail}
        </div>
      </div>
      <Badge tone="neutral">{AUTH_LABELS[authType] || authType}</Badge>
    </div>
  );
}
