import React from "react";

/**
 * SSMSX ContextMenu — the floating right-click menu used across the explorer,
 * connection list, and query tabs. Render at a fixed (x, y); items support
 * `danger`, `disabled`, and `separator`.
 */
export function ContextMenu({ x = 0, y = 0, items = [], onClose, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose && onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 50,
        minWidth: 140,
        fontFamily: "var(--font-ui)",
        background: "var(--surface-overlay)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "var(--shadow-md)",
        padding: "2px 0",
        ...style,
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} style={{ margin: "4px 8px", borderTop: "1px solid var(--border-default)" }} />
        ) : (
          <MenuButton key={item.label} item={item} onClose={onClose} />
        )
      )}
    </div>
  );
}

function MenuButton({ item, onClose }) {
  const [hover, setHover] = React.useState(false);
  const color = item.danger ? "var(--status-error)" : item.disabled ? "var(--text-secondary)" : "var(--text-primary)";
  return (
    <button
      type="button"
      disabled={item.disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        if (item.disabled) return;
        item.onClick && item.onClick();
        onClose && onClose();
      }}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-sm)",
        padding: "6px 12px",
        border: "none",
        background: hover && !item.disabled ? "var(--surface-raised)" : "transparent",
        color,
        opacity: item.disabled ? 0.5 : 1,
        cursor: item.disabled ? "not-allowed" : "pointer",
      }}
    >
      {item.label}
    </button>
  );
}
