import React from "react";

/**
 * SSMSX Badge — a compact metadata chip. Use `tone="neutral"` for the
 * auth-type chips (SQL / CS / Entra) and status tones for run state.
 */
export function Badge({ tone = "neutral", children, style, ...rest }) {
  const tones = {
    neutral: { background: "var(--surface-raised)", color: "var(--text-secondary)" },
    accent: { background: "var(--accent-selected)", color: "var(--accent)" },
    success: { background: "color-mix(in srgb, var(--status-success) 14%, transparent)", color: "var(--status-success)" },
    error: { background: "var(--status-error-soft)", color: "var(--status-error)" },
    warning: { background: "color-mix(in srgb, var(--status-warning) 16%, transparent)", color: "var(--status-warning)" },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-2xs)",
        fontWeight: "var(--weight-medium)",
        lineHeight: 1,
        padding: "3px 6px",
        borderRadius: "var(--radius-xs)",
        whiteSpace: "nowrap",
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
