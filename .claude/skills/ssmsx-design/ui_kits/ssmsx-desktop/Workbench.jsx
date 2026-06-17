// SSMSX workbench — toolbar, object explorer, query editor, results, status bar.
const { Button, TreeRow, QueryTab, NodeIcon, ContextMenu } = window.SSMSXDesignSystem_453330;

const KW = /\b(SELECT|TOP|FROM|WHERE|ORDER|BY|AS|AND|OR|INNER|JOIN|ON|GROUP|HAVING|INSERT|UPDATE|DELETE|INTO|VALUES|SET|NULL|IS|NOT|LIKE)\b/g;

function highlight(line) {
  const parts = [];
  let last = 0, m;
  KW.lastIndex = 0;
  while ((m = KW.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(<span key={m.index} style={{ color: "var(--accent)", fontWeight: 600 }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

function SqlEditor({ sql }) {
  const lines = sql.split("\n");
  return (
    <div style={{ flex: 1, display: "flex", overflow: "auto", background: "var(--surface-input)", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: "20px" }}>
      <div style={{ padding: "10px 10px 10px 14px", textAlign: "right", color: "var(--text-secondary)", opacity: 0.6, userSelect: "none", borderRight: "1px solid var(--border-default)" }}>
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre style={{ margin: 0, padding: "10px 16px", color: "var(--text-primary)", whiteSpace: "pre" }}>
        {lines.map((l, i) => <div key={i}>{highlight(l)}{l === "" ? "\u200b" : ""}</div>)}
      </pre>
    </div>
  );
}

function ResultsGrid({ tab, onTab }) {
  const data = window.SSMSX_DATA;
  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", borderTop: "1px solid var(--border-default)", maxHeight: "46%" }}>
      <div style={{ display: "flex", background: "var(--surface-panel)", borderBottom: "1px solid var(--border-default)", fontSize: "var(--text-xs)" }}>
        <button onClick={() => onTab("results")} style={{ padding: "5px 12px", border: "none", background: "transparent", cursor: "pointer", borderBottom: tab === "results" ? "2px solid var(--accent)" : "2px solid transparent", color: tab === "results" ? "var(--text-primary)" : "var(--text-secondary)", marginBottom: -1 }}>Results ({data.rowsAffected})</button>
        <button onClick={() => onTab("messages")} style={{ padding: "5px 12px", border: "none", background: "transparent", cursor: "pointer", borderBottom: tab === "messages" ? "2px solid var(--accent)" : "2px solid transparent", color: tab === "messages" ? "var(--text-primary)" : "var(--text-secondary)", marginBottom: -1 }}>Messages</button>
      </div>
      {tab === "results" ? (
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr>
                <th style={thStyle}></th>
                {data.columns.map((c) => <th key={c} style={thStyle}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, ri) => (
                <tr key={ri} className="grid-row">
                  <td style={{ ...tdStyle, color: "var(--text-secondary)", background: "var(--surface-panel)", textAlign: "right" }}>{ri + 1}</td>
                  {row.map((cell, ci) => <td key={ci} style={tdStyle}>{String(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflow: "auto", padding: 8, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
          <div>(12 rows affected)</div>
          <div>Completion time: {data.elapsed}</div>
        </div>
      )}
    </div>
  );
}
const thStyle = { whiteSpace: "nowrap", borderBottom: "1px solid var(--border-default)", borderRight: "1px solid var(--border-default)", padding: "3px 8px", textAlign: "left", fontWeight: 500, color: "var(--text-secondary)", background: "var(--surface-panel)" };
const tdStyle = { whiteSpace: "nowrap", borderBottom: "1px solid var(--border-default)", borderRight: "1px solid var(--border-default)", padding: "2px 8px", color: "var(--text-primary)" };

function Workbench({ connection, onAddConnection, onDisconnect }) {
  const data = window.SSMSX_DATA;
  const [expanded, setExpanded] = React.useState(new Set(data.expanded));
  const [selectedNode, setSelectedNode] = React.useState("t-customer");
  const [tabs, setTabs] = React.useState([{ id: "q1", title: "Query 1", database: "Sales", dirty: true }]);
  const [activeTab, setActiveTab] = React.useState("q1");
  const [resultTab, setResultTab] = React.useState("results");
  const [executed, setExecuted] = React.useState(true);
  const [menu, setMenu] = React.useState(null);

  const visible = data.tree.filter((n) => {
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

  const toggle = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addTab = () => {
    const id = "q" + (tabs.length + 1);
    setTabs([...tabs, { id, title: "Query " + (tabs.length + 1), database: connection.database }]);
    setActiveTab(id);
    setExecuted(false);
  };
  const closeTab = (id) => {
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (activeTab === id && next.length) setActiveTab(next[next.length - 1].id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--surface-app)", color: "var(--text-primary)", fontFamily: "var(--font-ui)" }} onClick={() => setMenu(null)}>
      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border-default)", background: "var(--surface-panel)", padding: "8px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="../../assets/icon.svg" width="18" height="18" style={{ borderRadius: 4 }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, letterSpacing: "var(--tracking-wide)" }}>SSMSx</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: connection.color }} />
          <span style={{ fontSize: "var(--text-sm)" }}>{connection.name || connection.serverName}</span>
          <Button variant="secondary" size="xs" onClick={onDisconnect}>×</Button>
        </div>
        <Button variant="primary" onClick={onAddConnection}>Add Connection</Button>
      </div>

      {/* main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* explorer */}
        <div style={{ width: "var(--explorer-width)", flexShrink: 0, borderRight: "1px solid var(--border-default)", display: "flex", flexDirection: "column" }}>
          <div style={{ borderBottom: "1px solid var(--border-default)", padding: "6px 12px" }}>
            <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, letterSpacing: "var(--tracking-wider)", color: "var(--text-secondary)" }}>OBJECT EXPLORER</span>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {visible.map((n) => (
              <TreeRow key={n.id} type={n.type} label={n.label} depth={n.depth}
                hasChildren={n.hasChildren} expanded={expanded.has(n.id)} selected={selectedNode === n.id}
                color={n.color}
                onSelect={() => setSelectedNode(n.id)}
                onToggle={() => toggle(n.id)} />
            ))}
          </div>
        </div>

        {/* content */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* tab bar */}
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border-default)", background: "var(--surface-panel)" }}>
            {tabs.map((t) => (
              <QueryTab key={t.id} title={t.title} database={t.database} active={activeTab === t.id} dirty={t.dirty}
                color={connection.color} onSelect={() => setActiveTab(t.id)} onClose={() => closeTab(t.id)} />
            ))}
            <button onClick={addTab} title="New Query (Ctrl+N)" style={{ padding: "6px 10px", border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 }}>+</button>
          </div>

          {/* query toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid var(--border-default)", background: "var(--surface-panel)", padding: "4px 8px" }}>
            <Button variant="ghost" size="xs" leadingIcon={<span style={{ color: "var(--status-success)" }}>▶</span>} onClick={() => { setExecuted(true); setResultTab("results"); }}>Execute</Button>
            <Button variant="ghost" size="xs" leadingIcon={<span style={{ color: "var(--accent)" }}>▶|</span>}>Selection</Button>
            <div style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />
            <Button variant="ghost" size="xs" leadingIcon={<span style={{ color: "var(--status-error)" }}>■</span>}>Cancel</Button>
          </div>

          {/* editor */}
          <SqlEditor sql={data.sql} />

          {/* results */}
          {executed && <ResultsGrid tab={resultTab} onTab={setResultTab} />}

          {/* status bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, borderTop: "1px solid var(--border-default)", background: "var(--surface-panel)", padding: "3px 12px", fontSize: "var(--text-xs)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: connection.color }} />
              <span style={{ color: "var(--text-secondary)" }}>{connection.name || connection.serverName} · {connection.database}</span>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ color: "var(--status-success)" }}>{executed ? "Completed" : "Ready"}</span>
            {executed && <span style={{ color: "var(--text-secondary)" }}>{data.elapsed}</span>}
            {executed && <span style={{ color: "var(--text-secondary)" }}>{data.rowsAffected} rows</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Workbench = Workbench;
