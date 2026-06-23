// SSMSX connection dialog — recreation of the "Connect to Server" modal.
const { Button, Input, ConnectionItem, Badge } = window.SSMSXDesignSystem_453330;

function ConnectDialog({ onConnect, onClose }) {
  const data = window.SSMSX_DATA;
  const [tab, setTab] = React.useState("properties");
  const [selected, setSelected] = React.useState(data.connections[0]);
  const tabs = [
    { key: "properties", label: "Properties" },
    { key: "connectionString", label: "Connection String" },
    { key: "custom", label: "Custom" },
  ];

  const field = (label, child) => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: 4 }}>{label}</span>
      {child}
    </label>
  );

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
      <div style={{ width: 700, maxWidth: "92%", background: "var(--surface-app)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden", display: "flex", flexDirection: "column", height: 480 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-default)", padding: "12px 16px" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 600 }}>Connect to Server</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 18, color: "var(--text-secondary)", cursor: "pointer" }}>×</button>
        </div>
        {/* body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* recent */}
          <div style={{ width: 230, flexShrink: 0, borderRight: "1px solid var(--border-default)", padding: 12, overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-2xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--text-secondary)" }}>Recent</h3>
            <Input placeholder="Search connections..." style={{ marginBottom: 8 }} />
            {data.connections.map((c) => (
              <ConnectionItem key={c.id} {...c} selected={selected.id === c.id}
                onClick={() => setSelected(c)} onDoubleClick={() => onConnect(c)} />
            ))}
          </div>
          {/* form */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-default)" }}>
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ padding: "8px 16px", fontSize: "var(--text-sm)", border: "none", borderBottom: tab === t.key ? "2px solid var(--accent-hover)" : "2px solid transparent", background: "transparent", color: tab === t.key ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer", marginBottom: -1 }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
              {tab === "properties" && (
                <div>
                  {field("Server name", <Input defaultValue={selected.serverName} />)}
                  {field("Authentication", (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge tone="accent">{selected.authType === "EntraMfa" ? "Microsoft Entra MFA" : selected.authType === "SqlAuth" ? "SQL Server Authentication" : "Connection String"}</Badge>
                    </div>
                  ))}
                  {selected.authType === "SqlAuth" && field("Login", <Input defaultValue={selected.username || ""} />)}
                  {selected.authType === "SqlAuth" && field("Password", <Input type="password" defaultValue="••••••••" />)}
                  {field("Database", <Input defaultValue={selected.database || "master"} />)}
                  {field("Color", (
                    <div style={{ display: "flex", gap: 10 }}>
                      {["--conn-blue","--conn-green","--conn-amber","--conn-red","--conn-violet"].map((v) => (
                        <span key={v} style={{ width: 22, height: 22, borderRadius: "var(--radius-full)", background: `var(${v})`, outline: selected.color === `var(${v})` ? "2px solid var(--text-primary)" : "none", outlineOffset: 2, cursor: "pointer" }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {tab === "connectionString" && (
                <div>
                  {field("Connection string", <Input defaultValue="Server=sql-prod-01.db;Database=Sales;Encrypt=Mandatory;" />)}
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>Paste a full ADO.NET connection string. SSMSX parses server, database and encryption settings automatically.</p>
                </div>
              )}
              {tab === "custom" && (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Advanced driver options (encrypt mode, trust server certificate, application name).</p>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 12, borderTop: "1px solid var(--border-default)" }}>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="ghost">Test</Button>
              <Button variant="primary" onClick={() => onConnect(selected)}>Connect</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ConnectDialog = ConnectDialog;
