import React from "react";

/**
 * SSMSX Object Explorer node icons — ported verbatim from the app's
 * NodeIcon. One glyph per SQL object type, drawn in `currentColor` so they
 * inherit the row's text color.
 */
export function NodeIcon({ type, folderKind, size = 16, style }) {
  const cn = { width: size, height: size, flexShrink: 0, ...style };
  switch (type) {
    case "server":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="1" width="12" height="4" rx="1" opacity="0.9" />
          <rect x="2" y="6" width="12" height="4" rx="1" opacity="0.7" />
          <rect x="2" y="11" width="12" height="4" rx="1" opacity="0.5" />
          <circle cx="11" cy="3" r="1" fill="#4ade80" />
          <circle cx="11" cy="8" r="1" fill="#4ade80" />
          <circle cx="11" cy="13" r="1" fill="#4ade80" />
        </svg>
      );
    case "database":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor">
          <ellipse cx="8" cy="3.5" rx="5.5" ry="2.5" />
          <path d="M2.5 3.5v9c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5v-9" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M2.5 7.5c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        </svg>
      );
    case "table":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="1.5" y="2" width="13" height="12" rx="1" />
          <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" />
          <line x1="1.5" y1="9" x2="14.5" y2="9" />
          <line x1="6" y1="5.5" x2="6" y2="14" />
        </svg>
      );
    case "view":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
    case "column":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor" opacity="0.6">
          <rect x="6" y="2" width="4" height="12" rx="1" />
        </svg>
      );
    case "key":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="5" cy="6" r="3" />
          <path d="M7.5 7.5L13 13" />
          <path d="M10.5 10.5L13 10.5" />
        </svg>
      );
    case "index":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
          <rect x="2" y="2" width="8" height="2" rx="0.5" />
          <rect x="2" y="5.5" width="10" height="2" rx="0.5" />
          <rect x="2" y="9" width="6" height="2" rx="0.5" />
          <rect x="2" y="12.5" width="12" height="2" rx="0.5" />
        </svg>
      );
    case "procedure":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M5 6l2.5 2L5 10" />
          <line x1="9" y1="10" x2="12" y2="10" />
        </svg>
      );
    case "function":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor">
          <text x="2" y="12.5" fontSize="11" fontStyle="italic" fontWeight="bold">fx</text>
        </svg>
      );
    case "user":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
          <circle cx="8" cy="5" r="3" />
          <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        </svg>
      );
    case "diagram":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="2" y="3" width="4" height="3" rx="0.5" />
          <rect x="10" y="3" width="4" height="3" rx="0.5" />
          <rect x="6" y="10" width="4" height="3" rx="0.5" />
          <path d="M6 4.5h4M8 6v4" />
        </svg>
      );
    case "folder":
      return (
        <svg style={cn} viewBox="0 0 16 16" fill="currentColor" opacity="0.6">
          <path d="M1 3h5l1.5 1.5H15v9.5H1z" />
        </svg>
      );
    default:
      return null;
  }
}
