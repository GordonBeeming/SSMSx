import React from "react";

/**
 * SSMSX QueryTab — one tab in the query tab bar. Active tabs use the complete
 * connection profile; inactive tabs retain its foreground marker.
 */
export function QueryTab({
  title,
  database,
  kind = "query",
  active = false,
  dirty = false,
  profileBackground,
  profileForeground,
  pinned = false,
  onTogglePinned,
  onSelect,
  onClose,
  onContextMenu,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const prefix = kind === "diagram" ? "Diagram — " : database ? `${database} — ` : "";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={onContextMenu}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        maxWidth: "var(--tab-max-width)",
        padding: "6px 12px",
        borderRight: "1px solid var(--border-default)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        background: active ? profileBackground : hover ? "var(--surface-raised)" : "transparent",
        color: active ? profileForeground : "var(--text-secondary)",
        cursor: "pointer",
        ...style,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: profileForeground, flexShrink: 0 }} />
      {pinned && (
        <button
          onClick={(event) => { event.stopPropagation(); onTogglePinned && onTogglePinned(); }}
          title="Unpin tab"
          aria-label="Unpin tab"
          style={{ display: "inline-flex", flexShrink: 0, border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 4v5l3 3v2h-4v6l-1 1-1-1v-6H7v-2l3-3V4z" /></svg>
        </button>
      )}
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
