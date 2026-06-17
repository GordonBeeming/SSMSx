/* @ds-bundle: {"format":3,"namespace":"SSMSXDesignSystem_453330","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Badge","sourcePath":"components/data/Badge.jsx"},{"name":"ConnectionItem","sourcePath":"components/data/ConnectionItem.jsx"},{"name":"NodeIcon","sourcePath":"components/explorer/NodeIcon.jsx"},{"name":"TreeRow","sourcePath":"components/explorer/TreeRow.jsx"},{"name":"QueryTab","sourcePath":"components/navigation/QueryTab.jsx"},{"name":"ContextMenu","sourcePath":"components/overlay/ContextMenu.jsx"}],"sourceHashes":{"components/core/Button.jsx":"ded9b1677762","components/core/Input.jsx":"27ad21d20aeb","components/data/Badge.jsx":"f7e0a48b1cf2","components/data/ConnectionItem.jsx":"eb0e906d87f6","components/explorer/NodeIcon.jsx":"406dc47c8c65","components/explorer/TreeRow.jsx":"e08f4dd10f1e","components/navigation/QueryTab.jsx":"2e4e971f9f95","components/overlay/ContextMenu.jsx":"96be389cc7e0","ui_kits/ssmsx-desktop/ConnectDialog.jsx":"693ba35ea438","ui_kits/ssmsx-desktop/Workbench.jsx":"3fd953a2e4f9","ui_kits/ssmsx-desktop/data.js":"743cee85c68b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SSMSXDesignSystem_453330 = window.SSMSXDesignSystem_453330 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SSMSX Button — the app's primary action control.
 * Variants mirror the real app: `primary` (accent), `secondary` (bordered),
 * `ghost` (toolbar), `dashed` (add-new), `danger` (destructive).
 */
function Button({
  variant = "primary",
  size = "sm",
  disabled = false,
  leadingIcon = null,
  children,
  style,
  ...rest
}) {
  const sizes = {
    xs: {
      fontSize: "var(--text-2xs)",
      padding: "2px 6px",
      gap: "4px"
    },
    sm: {
      fontSize: "var(--text-xs)",
      padding: "var(--pad-control-y) var(--pad-control-x)",
      gap: "4px"
    },
    md: {
      fontSize: "var(--text-sm)",
      padding: "8px 24px",
      gap: "6px"
    }
  };
  const variants = {
    primary: {
      background: "var(--accent)",
      color: "var(--accent-text)",
      border: "1px solid var(--accent)"
    },
    secondary: {
      background: "var(--surface-app)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-default)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-primary)",
      border: "1px solid transparent"
    },
    dashed: {
      background: "transparent",
      color: "var(--text-secondary)",
      border: "1px dashed var(--border-default)"
    },
    danger: {
      background: "var(--status-error)",
      color: "#fff",
      border: "1px solid var(--status-error)"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    "data-variant": variant,
    className: "ssmsx-btn",
    style: {
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
      ...style
    }
  }, rest), leadingIcon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex"
    }
  }, leadingIcon), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SSMSX text input — white field, subtle border, accent focus ring.
 * Matches the connection search / form fields.
 */
function Input({
  size = "sm",
  style,
  ...rest
}) {
  const sizes = {
    sm: {
      fontSize: "var(--text-xs)",
      padding: "6px 10px"
    },
    md: {
      fontSize: "var(--text-sm)",
      padding: "8px 12px"
    }
  };
  return /*#__PURE__*/React.createElement("input", _extends({
    className: "ssmsx-input",
    style: {
      width: "100%",
      fontFamily: "var(--font-ui)",
      color: "var(--text-primary)",
      background: "var(--surface-input)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      outline: "none",
      transition: "border-color 120ms ease",
      ...sizes[size],
      ...style
    },
    onFocus: e => e.currentTarget.style.borderColor = "var(--accent-hover)",
    onBlur: e => e.currentTarget.style.borderColor = "var(--border-default)"
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/data/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SSMSX Badge — a compact metadata chip. Use `tone="neutral"` for the
 * auth-type chips (SQL / CS / Entra) and status tones for run state.
 */
function Badge({
  tone = "neutral",
  children,
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      background: "var(--surface-raised)",
      color: "var(--text-secondary)"
    },
    accent: {
      background: "var(--accent-selected)",
      color: "var(--accent)"
    },
    success: {
      background: "color-mix(in srgb, var(--status-success) 14%, transparent)",
      color: "var(--status-success)"
    },
    error: {
      background: "var(--status-error-soft)",
      color: "var(--status-error)"
    },
    warning: {
      background: "color-mix(in srgb, var(--status-warning) 16%, transparent)",
      color: "var(--status-warning)"
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
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
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data/ConnectionItem.jsx
try { (() => {
const AUTH_LABELS = {
  SqlAuth: "SQL",
  ConnectionString: "CS",
  EntraMfa: "Entra"
};

/**
 * SSMSX ConnectionItem — a saved-connection row from the connection list.
 * Color dot, name + server/database/user detail, and an auth-type chip.
 */
function ConnectionItem({
  name,
  serverName,
  database,
  username,
  authType = "SqlAuth",
  color = "var(--conn-slate)",
  selected = false,
  onClick,
  onDoubleClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const bg = selected || hover ? "var(--surface-raised)" : "transparent";
  const detail = [serverName, database && `/ ${database}`, username && `— ${username}`].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onDoubleClick: onDoubleClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "var(--radius-sm)",
      background: bg,
      cursor: "pointer",
      fontFamily: "var(--font-ui)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: "var(--radius-full)",
      background: color,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-medium)",
      color: "var(--text-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, name || serverName), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, detail)), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral"
  }, AUTH_LABELS[authType] || authType));
}
Object.assign(__ds_scope, { ConnectionItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ConnectionItem.jsx", error: String((e && e.message) || e) }); }

// components/explorer/NodeIcon.jsx
try { (() => {
/**
 * SSMSX Object Explorer node icons — ported verbatim from the app's
 * NodeIcon. One glyph per SQL object type, drawn in `currentColor` so they
 * inherit the row's text color.
 */
function NodeIcon({
  type,
  folderKind,
  size = 16,
  style
}) {
  const cn = {
    width: size,
    height: size,
    flexShrink: 0,
    ...style
  };
  switch (type) {
    case "server":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "1",
        width: "12",
        height: "4",
        rx: "1",
        opacity: "0.9"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "6",
        width: "12",
        height: "4",
        rx: "1",
        opacity: "0.7"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "11",
        width: "12",
        height: "4",
        rx: "1",
        opacity: "0.5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "3",
        r: "1",
        fill: "#4ade80"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "8",
        r: "1",
        fill: "#4ade80"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "13",
        r: "1",
        fill: "#4ade80"
      }));
    case "database":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: "8",
        cy: "3.5",
        rx: "5.5",
        ry: "2.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2.5 3.5v9c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5v-9",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2.5 7.5c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "0.8",
        opacity: "0.5"
      }));
    case "table":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.2"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "1.5",
        y: "2",
        width: "13",
        height: "12",
        rx: "1"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "1.5",
        y1: "5.5",
        x2: "14.5",
        y2: "5.5"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "1.5",
        y1: "9",
        x2: "14.5",
        y2: "9"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "6",
        y1: "5.5",
        x2: "6",
        y2: "14"
      }));
    case "view":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.2"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "8",
        cy: "8",
        r: "2.5"
      }));
    case "column":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor",
        opacity: "0.6"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "6",
        y: "2",
        width: "4",
        height: "12",
        rx: "1"
      }));
    case "key":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.2"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "5",
        cy: "6",
        r: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M7.5 7.5L13 13"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10.5 10.5L13 10.5"
      }));
    case "index":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor",
        opacity: "0.7"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "2",
        width: "8",
        height: "2",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "5.5",
        width: "10",
        height: "2",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "9",
        width: "6",
        height: "2",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "12.5",
        width: "12",
        height: "2",
        rx: "0.5"
      }));
    case "procedure":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.2"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "2",
        width: "12",
        height: "12",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M5 6l2.5 2L5 10"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "9",
        y1: "10",
        x2: "12",
        y2: "10"
      }));
    case "function":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor"
      }, /*#__PURE__*/React.createElement("text", {
        x: "2",
        y: "12.5",
        fontSize: "11",
        fontStyle: "italic",
        fontWeight: "bold"
      }, "fx"));
    case "user":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor",
        opacity: "0.7"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "8",
        cy: "5",
        r: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
      }));
    case "diagram":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.2"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "3",
        width: "4",
        height: "3",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "10",
        y: "3",
        width: "4",
        height: "3",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "6",
        y: "10",
        width: "4",
        height: "3",
        rx: "0.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M6 4.5h4M8 6v4"
      }));
    case "folder":
      return /*#__PURE__*/React.createElement("svg", {
        style: cn,
        viewBox: "0 0 16 16",
        fill: "currentColor",
        opacity: "0.6"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M1 3h5l1.5 1.5H15v9.5H1z"
      }));
    default:
      return null;
  }
}
Object.assign(__ds_scope, { NodeIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/explorer/NodeIcon.jsx", error: String((e && e.message) || e) }); }

// components/explorer/TreeRow.jsx
try { (() => {
/**
 * SSMSX Object Explorer tree row — chevron, node icon, label. Indents by depth,
 * accent-tinted when selected. Server rows can show a connection color dot.
 */
function TreeRow({
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
  style
}) {
  const [hover, setHover] = React.useState(false);
  const bg = selected ? "var(--accent-selected)" : hover ? "var(--surface-raised)" : "transparent";
  const fg = selected || hover ? "var(--text-primary)" : "var(--text-secondary)";
  return /*#__PURE__*/React.createElement("div", {
    onClick: onSelect,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, loading ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: "50%",
      border: "2px solid var(--text-secondary)",
      borderTopColor: "transparent",
      display: "inline-block",
      animation: "ssmsx-spin 0.7s linear infinite"
    }
  }) : hasChildren ? /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 8 8",
    fill: "currentColor",
    style: {
      transform: expanded ? "rotate(90deg)" : "none",
      transition: "transform 120ms ease"
    },
    onClick: e => {
      e.stopPropagation();
      onToggle && onToggle();
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 1l4 3-4 3z"
  })) : null), type === "server" && color && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "var(--radius-full)",
      background: color,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.NodeIcon, {
    type: type
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, label));
}
Object.assign(__ds_scope, { TreeRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/explorer/TreeRow.jsx", error: String((e && e.message) || e) }); }

// components/navigation/QueryTab.jsx
try { (() => {
/**
 * SSMSX QueryTab — one tab in the query tab bar. Shows an optional connection
 * color dot, the "database — title" label, a dirty dot, and a close affordance.
 */
function QueryTab({
  title,
  database,
  kind = "query",
  active = false,
  dirty = false,
  color,
  onSelect,
  onClose,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const prefix = kind === "diagram" ? "Diagram — " : database ? `${database} — ` : "";
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
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
      ...style
    }
  }, color && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "var(--radius-full)",
      background: color,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onSelect,
    style: {
      minWidth: 0,
      border: "none",
      background: "transparent",
      color: "inherit",
      font: "inherit",
      padding: 0,
      cursor: "pointer",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, prefix, title), dirty && /*#__PURE__*/React.createElement("span", {
    title: "Unsaved changes",
    style: {
      flexShrink: 0,
      color: "var(--text-secondary)"
    }
  }, "\u2022"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    title: "Close tab",
    style: {
      marginLeft: 2,
      flexShrink: 0,
      border: "none",
      background: "transparent",
      color: "var(--text-secondary)",
      cursor: "pointer",
      padding: 0,
      opacity: hover ? 1 : 0,
      transition: "opacity 120ms ease"
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { QueryTab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/QueryTab.jsx", error: String((e && e.message) || e) }); }

// components/overlay/ContextMenu.jsx
try { (() => {
/**
 * SSMSX ContextMenu — the floating right-click menu used across the explorer,
 * connection list, and query tabs. Render at a fixed (x, y); items support
 * `danger`, `disabled`, and `separator`.
 */
function ContextMenu({
  x = 0,
  y = 0,
  items = [],
  onClose,
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose && onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
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
      ...style
    }
  }, items.map((item, i) => item.separator ? /*#__PURE__*/React.createElement("div", {
    key: `sep-${i}`,
    style: {
      margin: "4px 8px",
      borderTop: "1px solid var(--border-default)"
    }
  }) : /*#__PURE__*/React.createElement(MenuButton, {
    key: item.label,
    item: item,
    onClose: onClose
  })));
}
function MenuButton({
  item,
  onClose
}) {
  const [hover, setHover] = React.useState(false);
  const color = item.danger ? "var(--status-error)" : item.disabled ? "var(--text-secondary)" : "var(--text-primary)";
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: item.disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onClick: () => {
      if (item.disabled) return;
      item.onClick && item.onClick();
      onClose && onClose();
    },
    style: {
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
      cursor: item.disabled ? "not-allowed" : "pointer"
    }
  }, item.label);
}
Object.assign(__ds_scope, { ContextMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/ContextMenu.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ssmsx-desktop/ConnectDialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// SSMSX connection dialog — recreation of the "Connect to Server" modal.
const {
  Button,
  Input,
  ConnectionItem,
  Badge
} = window.SSMSXDesignSystem_453330;
function ConnectDialog({
  onConnect,
  onClose
}) {
  const data = window.SSMSX_DATA;
  const [tab, setTab] = React.useState("properties");
  const [selected, setSelected] = React.useState(data.connections[0]);
  const tabs = [{
    key: "properties",
    label: "Properties"
  }, {
    key: "connectionString",
    label: "Connection String"
  }, {
    key: "custom",
    label: "Custom"
  }];
  const field = (label, child) => /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      marginBottom: 4
    }
  }, label), child);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 700,
      maxWidth: "92%",
      background: "var(--surface-app)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: 480
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid var(--border-default)",
      padding: "12px 16px"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: "var(--text-base)",
      fontWeight: 600
    }
  }, "Connect to Server"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      border: "none",
      background: "transparent",
      fontSize: 18,
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 230,
      flexShrink: 0,
      borderRight: "1px solid var(--border-default)",
      padding: 12,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 8px",
      fontSize: "var(--text-2xs)",
      fontWeight: 500,
      letterSpacing: "var(--tracking-wider)",
      textTransform: "uppercase",
      color: "var(--text-secondary)"
    }
  }, "Recent"), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search connections...",
    style: {
      marginBottom: 8
    }
  }), data.connections.map(c => /*#__PURE__*/React.createElement(ConnectionItem, _extends({
    key: c.id
  }, c, {
    selected: selected.id === c.id,
    onClick: () => setSelected(c),
    onDoubleClick: () => onConnect(c)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderBottom: "1px solid var(--border-default)"
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.key,
    onClick: () => setTab(t.key),
    style: {
      padding: "8px 16px",
      fontSize: "var(--text-sm)",
      border: "none",
      borderBottom: tab === t.key ? "2px solid var(--accent-hover)" : "2px solid transparent",
      background: "transparent",
      color: tab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
      cursor: "pointer",
      marginBottom: -1
    }
  }, t.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      flex: 1,
      overflowY: "auto"
    }
  }, tab === "properties" && /*#__PURE__*/React.createElement("div", null, field("Server name", /*#__PURE__*/React.createElement(Input, {
    defaultValue: selected.serverName
  })), field("Authentication", /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, selected.authType === "EntraMfa" ? "Microsoft Entra MFA" : selected.authType === "SqlAuth" ? "SQL Server Authentication" : "Connection String"))), selected.authType === "SqlAuth" && field("Login", /*#__PURE__*/React.createElement(Input, {
    defaultValue: selected.username || ""
  })), selected.authType === "SqlAuth" && field("Password", /*#__PURE__*/React.createElement(Input, {
    type: "password",
    defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  })), field("Database", /*#__PURE__*/React.createElement(Input, {
    defaultValue: selected.database || "master"
  })), field("Color", /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, ["--conn-blue", "--conn-green", "--conn-amber", "--conn-red", "--conn-violet"].map(v => /*#__PURE__*/React.createElement("span", {
    key: v,
    style: {
      width: 22,
      height: 22,
      borderRadius: "var(--radius-full)",
      background: `var(${v})`,
      outline: selected.color === `var(${v})` ? "2px solid var(--text-primary)" : "none",
      outlineOffset: 2,
      cursor: "pointer"
    }
  }))))), tab === "connectionString" && /*#__PURE__*/React.createElement("div", null, field("Connection string", /*#__PURE__*/React.createElement(Input, {
    defaultValue: "Server=sql-prod-01.db;Database=Sales;Encrypt=Mandatory;"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      lineHeight: 1.5
    }
  }, "Paste a full ADO.NET connection string. SSMSX parses server, database and encryption settings automatically.")), tab === "custom" && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-secondary)"
    }
  }, "Advanced driver options (encrypt mode, trust server certificate, application name).")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      padding: 12,
      borderTop: "1px solid var(--border-default)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Test"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onConnect(selected)
  }, "Connect"))))));
}
window.ConnectDialog = ConnectDialog;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ssmsx-desktop/ConnectDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ssmsx-desktop/Workbench.jsx
try { (() => {
// SSMSX workbench — toolbar, object explorer, query editor, results, status bar.
const {
  Button,
  TreeRow,
  QueryTab,
  NodeIcon,
  ContextMenu
} = window.SSMSXDesignSystem_453330;
const KW = /\b(SELECT|TOP|FROM|WHERE|ORDER|BY|AS|AND|OR|INNER|JOIN|ON|GROUP|HAVING|INSERT|UPDATE|DELETE|INTO|VALUES|SET|NULL|IS|NOT|LIKE)\b/g;
function highlight(line) {
  const parts = [];
  let last = 0,
    m;
  KW.lastIndex = 0;
  while ((m = KW.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(/*#__PURE__*/React.createElement("span", {
      key: m.index,
      style: {
        color: "var(--accent)",
        fontWeight: 600
      }
    }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
function SqlEditor({
  sql
}) {
  const lines = sql.split("\n");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      overflow: "auto",
      background: "var(--surface-input)",
      fontFamily: "var(--font-mono)",
      fontSize: 13,
      lineHeight: "20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 10px 10px 14px",
      textAlign: "right",
      color: "var(--text-secondary)",
      opacity: 0.6,
      userSelect: "none",
      borderRight: "1px solid var(--border-default)"
    }
  }, lines.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, i + 1))), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      padding: "10px 16px",
      color: "var(--text-primary)",
      whiteSpace: "pre"
    }
  }, lines.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, highlight(l), l === "" ? "\u200b" : ""))));
}
function ResultsGrid({
  tab,
  onTab
}) {
  const data = window.SSMSX_DATA;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderTop: "1px solid var(--border-default)",
      maxHeight: "46%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      background: "var(--surface-panel)",
      borderBottom: "1px solid var(--border-default)",
      fontSize: "var(--text-xs)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onTab("results"),
    style: {
      padding: "5px 12px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      borderBottom: tab === "results" ? "2px solid var(--accent)" : "2px solid transparent",
      color: tab === "results" ? "var(--text-primary)" : "var(--text-secondary)",
      marginBottom: -1
    }
  }, "Results (", data.rowsAffected, ")"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onTab("messages"),
    style: {
      padding: "5px 12px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      borderBottom: tab === "messages" ? "2px solid var(--accent)" : "2px solid transparent",
      color: tab === "messages" ? "var(--text-primary)" : "var(--text-secondary)",
      marginBottom: -1
    }
  }, "Messages")), tab === "results" ? /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "var(--text-xs)",
      fontFamily: "var(--font-mono)"
    }
  }, /*#__PURE__*/React.createElement("thead", {
    style: {
      position: "sticky",
      top: 0
    }
  }, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: thStyle
  }), data.columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c,
    style: thStyle
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, data.rows.map((row, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    className: "grid-row"
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      ...tdStyle,
      color: "var(--text-secondary)",
      background: "var(--surface-panel)",
      textAlign: "right"
    }
  }, ri + 1), row.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    style: tdStyle
  }, String(cell)))))))) : /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "auto",
      padding: 8,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement("div", null, "(12 rows affected)"), /*#__PURE__*/React.createElement("div", null, "Completion time: ", data.elapsed)));
}
const thStyle = {
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--border-default)",
  borderRight: "1px solid var(--border-default)",
  padding: "3px 8px",
  textAlign: "left",
  fontWeight: 500,
  color: "var(--text-secondary)",
  background: "var(--surface-panel)"
};
const tdStyle = {
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--border-default)",
  borderRight: "1px solid var(--border-default)",
  padding: "2px 8px",
  color: "var(--text-primary)"
};
function Workbench({
  connection,
  onAddConnection,
  onDisconnect
}) {
  const data = window.SSMSX_DATA;
  const [expanded, setExpanded] = React.useState(new Set(data.expanded));
  const [selectedNode, setSelectedNode] = React.useState("t-customer");
  const [tabs, setTabs] = React.useState([{
    id: "q1",
    title: "Query 1",
    database: "Sales",
    dirty: true
  }]);
  const [activeTab, setActiveTab] = React.useState("q1");
  const [resultTab, setResultTab] = React.useState("results");
  const [executed, setExecuted] = React.useState(true);
  const [menu, setMenu] = React.useState(null);
  const visible = data.tree.filter(n => {
    if (n.depth === 0) return true;
    // show if every ancestor is expanded — approximate by walking parents via depth order
    let i = data.tree.indexOf(n);
    let depth = n.depth;
    for (let j = i - 1; j >= 0; j--) {
      if (data.tree[j].depth < depth) {
        if (!expanded.has(data.tree[j].id)) return false;
        depth = data.tree[j].depth;
        if (depth === 0) break;
      }
    }
    return true;
  });
  const toggle = id => setExpanded(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const addTab = () => {
    const id = "q" + (tabs.length + 1);
    setTabs([...tabs, {
      id,
      title: "Query " + (tabs.length + 1),
      database: connection.database
    }]);
    setActiveTab(id);
    setExecuted(false);
  };
  const closeTab = id => {
    const next = tabs.filter(t => t.id !== id);
    setTabs(next);
    if (activeTab === id && next.length) setActiveTab(next[next.length - 1].id);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--surface-app)",
      color: "var(--text-primary)",
      fontFamily: "var(--font-ui)"
    },
    onClick: () => setMenu(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      borderBottom: "1px solid var(--border-default)",
      background: "var(--surface-panel)",
      padding: "8px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/icon.svg",
    width: "18",
    height: "18",
    style: {
      borderRadius: 4
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      letterSpacing: "var(--tracking-wide)"
    }
  }, "SSMSx")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "var(--radius-full)",
      background: connection.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)"
    }
  }, connection.name || connection.serverName), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "xs",
    onClick: onDisconnect
  }, "\xD7")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onAddConnection
  }, "Add Connection")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "var(--explorer-width)",
      flexShrink: 0,
      borderRight: "1px solid var(--border-default)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid var(--border-default)",
      padding: "6px 12px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 600,
      letterSpacing: "var(--tracking-wider)",
      color: "var(--text-secondary)"
    }
  }, "OBJECT EXPLORER")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: "auto"
    }
  }, visible.map(n => /*#__PURE__*/React.createElement(TreeRow, {
    key: n.id,
    type: n.type,
    label: n.label,
    depth: n.depth,
    hasChildren: n.hasChildren,
    expanded: expanded.has(n.id),
    selected: selectedNode === n.id,
    color: n.color,
    onSelect: () => setSelectedNode(n.id),
    onToggle: () => toggle(n.id)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--surface-panel)"
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement(QueryTab, {
    key: t.id,
    title: t.title,
    database: t.database,
    active: activeTab === t.id,
    dirty: t.dirty,
    color: connection.color,
    onSelect: () => setActiveTab(t.id),
    onClose: () => closeTab(t.id)
  })), /*#__PURE__*/React.createElement("button", {
    onClick: addTab,
    title: "New Query (Ctrl+N)",
    style: {
      padding: "6px 10px",
      border: "none",
      background: "transparent",
      color: "var(--text-secondary)",
      cursor: "pointer",
      fontSize: 14
    }
  }, "+")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      borderBottom: "1px solid var(--border-default)",
      background: "var(--surface-panel)",
      padding: "4px 8px"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "xs",
    leadingIcon: /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--status-success)"
      }
    }, "\u25B6"),
    onClick: () => {
      setExecuted(true);
      setResultTab("results");
    }
  }, "Execute"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "xs",
    leadingIcon: /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--accent)"
      }
    }, "\u25B6|")
  }, "Selection"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 16,
      background: "var(--border-default)",
      margin: "0 4px"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "xs",
    leadingIcon: /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--status-error)"
      }
    }, "\u25A0")
  }, "Cancel")), /*#__PURE__*/React.createElement(SqlEditor, {
    sql: data.sql
  }), executed && /*#__PURE__*/React.createElement(ResultsGrid, {
    tab: resultTab,
    onTab: setResultTab
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      borderTop: "1px solid var(--border-default)",
      background: "var(--surface-panel)",
      padding: "3px 12px",
      fontSize: "var(--text-xs)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "var(--radius-full)",
      background: connection.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)"
    }
  }, connection.name || connection.serverName, " \xB7 ", connection.database)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--status-success)"
    }
  }, executed ? "Completed" : "Ready"), executed && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)"
    }
  }, data.elapsed), executed && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)"
    }
  }, data.rowsAffected, " rows")))));
}
window.Workbench = Workbench;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ssmsx-desktop/Workbench.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ssmsx-desktop/data.js
try { (() => {
// Fake schema + result data for the SSMSX desktop UI kit. Not real — for visual recreation only.
window.SSMSX_DATA = {
  connections: [{
    id: "c1",
    name: "Prod — Reporting",
    serverName: "sql-prod-01.db",
    database: "Sales",
    username: "reader",
    authType: "EntraMfa",
    color: "var(--conn-red)"
  }, {
    id: "c2",
    name: "Local Dev",
    serverName: "localhost,1433",
    database: "Northwind",
    username: "sa",
    authType: "SqlAuth",
    color: "var(--conn-green)"
  }, {
    id: "c3",
    name: "Staging",
    serverName: "staging.internal",
    database: "App",
    authType: "ConnectionString",
    color: "var(--conn-amber)"
  }],
  // Object Explorer tree, flattened with depth. `id` used for expand toggling.
  tree: [{
    id: "srv",
    type: "server",
    label: "sql-prod-01",
    depth: 0,
    hasChildren: true,
    color: "var(--conn-red)"
  }, {
    id: "db-sales",
    type: "database",
    label: "Sales",
    depth: 1,
    hasChildren: true
  }, {
    id: "f-tables",
    type: "folder",
    label: "Tables",
    depth: 2,
    hasChildren: true
  }, {
    id: "t-customer",
    type: "table",
    label: "dbo.Customer",
    depth: 3,
    hasChildren: true
  }, {
    id: "c-id",
    type: "column",
    label: "CustomerId  int  (PK, identity)",
    depth: 4
  }, {
    id: "c-name",
    type: "column",
    label: "Name  nvarchar(120)",
    depth: 4
  }, {
    id: "c-city",
    type: "column",
    label: "City  nvarchar(80)  null",
    depth: 4
  }, {
    id: "k-pk",
    type: "key",
    label: "PK_Customer",
    depth: 4
  }, {
    id: "ix-name",
    type: "index",
    label: "IX_Customer_Name",
    depth: 4
  }, {
    id: "t-orders",
    type: "table",
    label: "dbo.Orders",
    depth: 3,
    hasChildren: true
  }, {
    id: "t-orderline",
    type: "table",
    label: "dbo.OrderLine",
    depth: 3,
    hasChildren: true
  }, {
    id: "t-product",
    type: "table",
    label: "dbo.Product",
    depth: 3,
    hasChildren: true
  }, {
    id: "f-views",
    type: "folder",
    label: "Views",
    depth: 2,
    hasChildren: true
  }, {
    id: "v-sales",
    type: "view",
    label: "dbo.vMonthlySales",
    depth: 3
  }, {
    id: "f-prog",
    type: "folder",
    label: "Programmability",
    depth: 2,
    hasChildren: true,
    folderKind: "programmability"
  }, {
    id: "p-orders",
    type: "procedure",
    label: "usp_GetOrders",
    depth: 3
  }, {
    id: "fn-tax",
    type: "function",
    label: "fn_CalcTax",
    depth: 3
  }, {
    id: "f-sec",
    type: "folder",
    label: "Security",
    depth: 2,
    hasChildren: true,
    folderKind: "security"
  }, {
    id: "u-reader",
    type: "user",
    label: "reader",
    depth: 3
  }, {
    id: "f-diagrams",
    type: "folder",
    label: "Database Diagrams",
    depth: 2,
    hasChildren: true
  }, {
    id: "dg-1",
    type: "diagram",
    label: "Sales overview",
    depth: 3
  }],
  // ids visible when collapsed to just server>db>folders (initial expanded set)
  expanded: ["srv", "db-sales", "f-tables"],
  sql: "SELECT TOP 100 c.CustomerId, c.Name, c.City, c.Country,\n       c.IsActive, c.CreatedAt\nFROM   dbo.Customer AS c\nWHERE  c.IsActive = 1\nORDER  BY c.Name;",
  columns: ["CustomerId", "Name", "City", "Country", "IsActive", "CreatedAt"],
  rows: [[1042, "Aurora Logistics", "Sydney", "AU", 1, "2023-02-11 09:14"], [1088, "Beacon Foods", "Melbourne", "AU", 1, "2023-03-02 14:51"], [1120, "Cobalt Systems", "Auckland", "NZ", 1, "2023-05-19 08:03"], [1153, "Delta Press", "Brisbane", "AU", 1, "2023-06-22 11:38"], [1201, "Evergreen Co", "Perth", "AU", 1, "2023-08-01 16:20"], [1247, "Forge Metals", "Hamilton", "NZ", 1, "2023-09-14 10:09"], [1290, "Granite Bank", "Sydney", "AU", 1, "2023-10-30 13:45"], [1334, "Harbor Freight", "Wellington", "NZ", 1, "2023-12-05 07:52"], [1378, "Ionic Labs", "Canberra", "AU", 1, "2024-01-18 09:31"], [1405, "Juniper Retail", "Adelaide", "AU", 1, "2024-02-27 15:14"], [1450, "Kelvin Cold Storage", "Christchurch", "NZ", 1, "2024-04-09 12:00"], [1492, "Lumen Energy", "Darwin", "AU", 1, "2024-05-21 08:47"]],
  rowsAffected: 12,
  elapsed: "00:00:00.214"
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ssmsx-desktop/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.ConnectionItem = __ds_scope.ConnectionItem;

__ds_ns.NodeIcon = __ds_scope.NodeIcon;

__ds_ns.TreeRow = __ds_scope.TreeRow;

__ds_ns.QueryTab = __ds_scope.QueryTab;

__ds_ns.ContextMenu = __ds_scope.ContextMenu;

})();
