import React from "react";

/**
 * SSMSX Button — the app's primary action control.
 * Variants mirror the real app: `primary` (accent), `secondary` (bordered),
 * `ghost` (toolbar), `dashed` (add-new), `danger` (destructive).
 */
export function Button({
  variant = "primary",
  size = "sm",
  disabled = false,
  leadingIcon = null,
  children,
  style,
  ...rest
}) {
  const sizes = {
    xs: { fontSize: "var(--text-2xs)", padding: "2px 6px", gap: "4px" },
    sm: { fontSize: "var(--text-xs)", padding: "var(--pad-control-y) var(--pad-control-x)", gap: "4px" },
    md: { fontSize: "var(--text-sm)", padding: "8px 24px", gap: "6px" },
  };

  const variants = {
    primary: {
      background: "var(--accent)",
      color: "var(--accent-text)",
      border: "1px solid var(--accent)",
    },
    secondary: {
      background: "var(--surface-app)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-default)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-primary)",
      border: "1px solid transparent",
    },
    dashed: {
      background: "transparent",
      color: "var(--text-secondary)",
      border: "1px dashed var(--border-default)",
    },
    danger: {
      background: "var(--status-error)",
      color: "#fff",
      border: "1px solid var(--status-error)",
    },
  };

  return (
    <button
      disabled={disabled}
      data-variant={variant}
      className="ssmsx-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-ui)",
        fontWeight: "var(--weight-medium)",
        lineHeight: 1,
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
        whiteSpace: "nowrap",
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {leadingIcon && <span style={{ display: "inline-flex" }}>{leadingIcon}</span>}
      {children}
    </button>
  );
}
