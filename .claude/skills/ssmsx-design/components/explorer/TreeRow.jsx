import React from "react";
import { NodeIcon } from "./NodeIcon";

/**
 * SSMSX Object Explorer tree row — chevron, node icon, label. Indents by depth,
 * accent-tinted when selected. Server rows can show a connection color dot.
 */
export function TreeRow({
  type,
  label,
  depth = 0,
  expanded = false,
  hasChildren = false,
  loading = false,
  selected = false,
  color,
  onToggle,
  onSelect,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const bg = selected ? "var(--accent-selected)" : hover ? "var(--surface-raised)" : "transparent";
  const fg = selected || hover ? "var(--text-primary)" : "var(--text-secondary)";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        height: "var(--row-height)",
        paddingTop: "var(--pad-row-y)",
        paddingBottom: "var(--pad-row-y)",
        paddingRight: "8px",
        paddingLeft: `${depth * 16 + 4}px`,
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        color: fg,
        background: bg,
        cursor: "pointer",
        userSelect: "none",
        ...style,
      }}
    >
      <span style={{ display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {loading ? (
          <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--text-secondary)", borderTopColor: "transparent", display: "inline-block", animation: "ssmsx-spin 0.7s linear infinite" }} />
        ) : hasChildren ? (
          <svg
            width="9" height="9" viewBox="0 0 8 8" fill="currentColor"
            style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 120ms ease" }}
            onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
          >
            <path d="M2 1l4 3-4 3z" />
          </svg>
        ) : null}
      </span>

      {type === "server" && color && (
        <span style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: color, flexShrink: 0 }} />
      )}

      <NodeIcon type={type} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}
