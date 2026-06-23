import React from "react";

/**
 * SSMSX text input — white field, subtle border, accent focus ring.
 * Matches the connection search / form fields.
 */
export function Input({ size = "sm", style, ...rest }) {
  const sizes = {
    sm: { fontSize: "var(--text-xs)", padding: "6px 10px" },
    md: { fontSize: "var(--text-sm)", padding: "8px 12px" },
  };
  return (
    <input
      className="ssmsx-input"
      style={{
        width: "100%",
        fontFamily: "var(--font-ui)",
        color: "var(--text-primary)",
        background: "var(--surface-input)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        outline: "none",
        transition: "border-color 120ms ease",
        ...sizes[size],
        ...style,
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-hover)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
      {...rest}
    />
  );
}
