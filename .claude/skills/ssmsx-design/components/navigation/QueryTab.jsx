import React from "react";

/**
 * SSMSX QueryTab — one tab in the query tab bar. Shows an optional connection
 * color dot, the "database — title" label, a dirty dot, and a close affordance.
 */
export function QueryTab({
  title,
  database,
  kind = "query",
  active = false,
  dirty = false,
  color,
  onSelect,
  onClose,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const prefix = kind === "diagram" ? "Diagram — " : database ? `${database} — ` : "";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        maxWidth: "var(--tab-max-width)",
        padding: "6px 12px",
        borderRight: "1px solid var(--border-default)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        background: active ? "var(--surface-app)" : hover ? "var(--surface-raised)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer",
        ...style,
      }}
    >
      {color && <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: color, flexShrink: 0 }} />}
      <button
        onClick={onSelect}
        style={{ minWidth: 0, border: "none", background: "transparent", color: "inherit", font: "inherit", padding: 0, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {prefix}{title}
      </button>
      {dirty && <span title="Unsaved changes" style={{ flexShrink: 0, color: "var(--text-secondary)" }}>•</span>}
      <button
        onClick={onClose}
        title="Close tab"
        style={{
          marginLeft: 2, flexShrink: 0, border: "none", background: "transparent",
          color: "var(--text-secondary)", cursor: "pointer", padding: 0,
          opacity: hover ? 1 : 0, transition: "opacity 120ms ease",
        }}
      >
        ×
      </button>
    </div>
  );
}
