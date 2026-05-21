import { useState, useEffect } from "react";
import type { ConnectionInfo } from "../types";
import { isAuthType, isEncryptMode } from "../types";
import { useConnectionStore } from "../store/connectionStore";

const DEFAULT_CONNECTION: Omit<ConnectionInfo, "id" | "createdAt"> = {
  name: "",
  serverName: "",
  authType: "SqlAuth",
  username: "",
  database: "",
  encrypt: "Mandatory",
  trustServerCertificate: false,
};

export function PropertiesTab() {
  const {
    connections,
    selectedConnection,
    selectionVersion,
    loading,
    testResult,
    saveConnection,
    testConnection,
    connect,
    setFormDirty,
  } = useConnectionStore();

  const [form, setForm] = useState(DEFAULT_CONNECTION);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [isDirtyIdentity, setIsDirtyIdentity] = useState(false);

  const hasStoredPassword = !!form.credentialRef;

  useEffect(() => {
    if (selectedConnection) {
      setForm({
        name: selectedConnection.name || "",
        serverName: selectedConnection.serverName,
        authType: selectedConnection.authType,
        username: selectedConnection.username || "",
        database: selectedConnection.database || "",
        encrypt: selectedConnection.encrypt,
        trustServerCertificate: selectedConnection.trustServerCertificate,
        connectionString: selectedConnection.connectionString,
        color: selectedConnection.color,
        credentialRef: selectedConnection.credentialRef,
      });
    } else {
      setForm(DEFAULT_CONNECTION);
    }
    setPassword("");
    setIsDirtyIdentity(false);
  }, [selectedConnection, selectionVersion]);

  // Fields that make this a new connection when changed
  const identityFields = new Set(["serverName", "username", "authType"]);

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setFormDirty(true);
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (identityFields.has(key)) {
        if (prev.credentialRef) {
          next.credentialRef = undefined;
        }
        // Check if identity fields still differ from saved connection
        if (selectedConnection) {
          const isDiff =
            next.serverName !== selectedConnection.serverName ||
            next.username !== (selectedConnection.username || "") ||
            next.authType !== selectedConnection.authType;
          setIsDirtyIdentity(isDiff);
        }
      }
      return next;
    });
  };

  const recentServers = [
    ...new Set(connections.map((c) => c.serverName)),
  ].slice(0, 10);

  // When identity fields changed, treat as a new connection (new ID)
  const isNewConnection = !selectedConnection || isDirtyIdentity;

  const buildConnectionInfo = (): ConnectionInfo => ({
    ...form,
    id: isNewConnection ? crypto.randomUUID() : selectedConnection.id,
    createdAt: isNewConnection ? new Date().toISOString() : selectedConnection.createdAt,
    lastUsed: isNewConnection ? undefined : selectedConnection.lastUsed,
  });

  const handleTest = async () => {
    if (!form.serverName) return;
    await testConnection(buildConnectionInfo(), password || undefined);
  };

  const handleConnect = async () => {
    if (!form.serverName) return;
    const info = buildConnectionInfo();

    // Test connection before saving/connecting
    const result = await testConnection(info, password || undefined);
    if (!result.success) return;

    // Save if it's a new connection, identity changed, or password updated
    const hasNewPassword = !!password;
    const needsSave = isNewConnection || hasNewPassword || !rememberPassword;
    let connectionId = info.id;
    if (needsSave) {
      const wantsClear = !rememberPassword && !!selectedConnection?.credentialRef;
      const infoToSave = rememberPassword
        ? info
        : { ...info, credentialRef: undefined };
      const saved = await saveConnection(
        infoToSave,
        rememberPassword && hasNewPassword ? password : undefined,
        wantsClear
      );
      connectionId = saved.id;
    }

    await connect(connectionId);
  };

  const needsUsername =
    form.authType === "SqlAuth" || form.authType === "EntraMfa";
  const needsPassword = form.authType === "SqlAuth";

  const handleAuthTypeChange = (value: string) => {
    if (isAuthType(value)) {
      update("authType", value);
    }
  };

  const handleEncryptModeChange = (value: string) => {
    if (isEncryptMode(value)) {
      update("encrypt", value);
    }
  };

  return (
    <div className="flex h-full flex-col">
    <div className="flex-1 overflow-y-auto">
    <div className="flex flex-col gap-3">
      {/* Server Name */}
      <div>
        <label className="mb-1 block text-xs text-text-secondary">
          Server Name
        </label>
        <input
          type="text"
          list="recent-servers"
          value={form.serverName}
          onChange={(e) => update("serverName", e.target.value)}
          placeholder="localhost or server.database.windows.net"
          className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
        />
        <datalist id="recent-servers">
          {recentServers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {/* Authentication */}
      <div>
        <label className="mb-1 block text-xs text-text-secondary">
          Authentication
        </label>
        <select
          value={form.authType}
          onChange={(e) => handleAuthTypeChange(e.target.value)}
          className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary focus:border-accent-hover focus:outline-none"
        >
          <option value="SqlAuth">SQL Server Authentication</option>
          <option value="ConnectionString">Connection String</option>
          <option value="EntraMfa">Microsoft Entra MFA</option>
        </select>
      </div>

      {/* Username */}
      {needsUsername && (
        <div>
          <label className="mb-1 block text-xs text-text-secondary">
            Username
          </label>
          <input
            type="text"
            value={form.username || ""}
            onChange={(e) => update("username", e.target.value)}
            placeholder={
              form.authType === "EntraMfa" ? "user@domain.com" : "sa"
            }
            className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
          />
        </div>
      )}

      {/* Password */}
      {needsPassword && (
        <div>
          <label className="mb-1 block text-xs text-text-secondary">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={hasStoredPassword ? "••••••••  (saved)" : ""}
              className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 pr-16 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent px-1 text-xs text-text-secondary hover:text-text-primary"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
              className="accent-accent-hover"
            />
            Remember password
          </label>
        </div>
      )}

      {/* Database */}
      <div>
        <label className="mb-1 block text-xs text-text-secondary">
          Database (optional)
        </label>
        <input
          type="text"
          value={form.database || ""}
          onChange={(e) => update("database", e.target.value)}
          placeholder="<default>"
          className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
        />
      </div>

      {/* Encrypt */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-secondary">
            Encrypt
          </label>
          <select
            value={form.encrypt}
            onChange={(e) => handleEncryptModeChange(e.target.value)}
            className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary focus:border-accent-hover focus:outline-none"
          >
            <option value="Mandatory">Mandatory</option>
            <option value="Optional">Optional</option>
            <option value="Strict">Strict</option>
          </select>
        </div>
        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={form.trustServerCertificate}
              onChange={(e) =>
                update("trustServerCertificate", e.target.checked)
              }
              className="accent-accent-hover"
            />
            Trust Server Certificate
          </label>
        </div>
      </div>
    </div>
    </div>

      {/* Test result + Buttons — fixed at bottom */}
      <div className="shrink-0 border-t border-bg-tertiary pt-3">
        {testResult && (
          <div
            className={`mb-3 rounded px-3 py-2 text-sm ${
              testResult.success
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            {testResult.success
              ? "Connection successful!"
              : `Connection failed: ${testResult.error}`}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleTest}
            disabled={loading || !form.serverName}
            className="rounded border border-bg-tertiary bg-bg-secondary px-4 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleConnect}
            disabled={loading || !form.serverName}
            className="rounded bg-accent px-4 py-1.5 text-sm text-accent-text hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
