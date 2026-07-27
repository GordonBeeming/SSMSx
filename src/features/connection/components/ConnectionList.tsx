import type React from "react";
import { useState, useCallback } from "react";
import type { ConnectionInfo } from "../types";
import { useConnectionStore } from "../store/connectionStore";
import { ContextMenu, type ContextMenuItem } from "../../../shared/components/ContextMenu";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { getEffectiveAlias, resolveColorProfile } from "../../../shared/connectionAppearance";
import { useSettingsStore } from "../../settings";
import { ColorProfileMarker } from "../../../shared/components/ColorProfileMarker";

const AUTH_TYPE_LABELS: Record<string, string> = {
  SqlAuth: "SQL",
  ConnectionString: "CS",
  EntraMfa: "Entra",
};

export function ConnectionList() {
  const {
    connections,
    searchFilter,
    setSearchFilter,
    selectedConnection,
    selectConnection,
    connect,
    deleteConnection,
    setDialogTab,
    formDirty,
  } = useConnectionStore();
  const customProfiles = useSettingsStore((state) => state.settings.connections.colorProfiles);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    connection: ConnectionInfo;
  } | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const filtered = connections.filter((c) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      getEffectiveAlias(c).toLowerCase().includes(q) ||
      c.serverName.toLowerCase().includes(q) ||
      c.database?.toLowerCase().includes(q)
    );
  });

  const switchToConnection = useCallback(
    (c: ConnectionInfo) => {
      selectConnection(c);
      setDialogTab("properties");
    },
    [selectConnection, setDialogTab]
  );

  const handleClick = useCallback(
    (c: ConnectionInfo) => {
      if (formDirty) {
        setConfirmAction({
          title: "Unsaved Changes",
          message: "You have unsaved changes. Load this connection and discard them?",
          confirmLabel: "Discard & Load",
          onConfirm: () => {
            switchToConnection(c);
            setConfirmAction(null);
          },
        });
        return;
      }
      switchToConnection(c);
    },
    [formDirty, switchToConnection]
  );

  const handleNewConnection = useCallback(() => {
    const doNew = () => {
      selectConnection(null);
      setDialogTab("properties");
    };
    if (formDirty) {
      setConfirmAction({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Start a new connection and discard them?",
        confirmLabel: "Discard & New",
        onConfirm: () => {
          doNew();
          setConfirmAction(null);
        },
      });
      return;
    }
    doNew();
  }, [formDirty, selectConnection, setDialogTab]);

  const handleDoubleClick = useCallback(
    (c: ConnectionInfo) => {
      connect(c.id);
    },
    [connect]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, c: ConnectionInfo) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, connection: c });
    },
    []
  );

  const handleDelete = useCallback(
    (c: ConnectionInfo) => {
      setConfirmAction({
        title: "Delete Connection",
        message: `Delete connection "${getEffectiveAlias(c)}"? This cannot be undone.`,
        confirmLabel: "Delete",
        danger: true,
        onConfirm: () => {
          deleteConnection(c.id);
          setConfirmAction(null);
        },
      });
    },
    [deleteConnection]
  );

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
        {
          type: "action",
          label: "Connect",
          onClick: () => connect(contextMenu.connection.id),
        },
        {
          type: "action",
          label: "Edit",
          onClick: () => {
            switchToConnection(contextMenu.connection);
          },
        },
        {
          type: "action",
          label: "Delete",
          danger: true,
          onClick: () => handleDelete(contextMenu.connection),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        aria-label="Search connections"
        placeholder="Search connections..."
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
      />

      <button
        type="button"
        onClick={handleNewConnection}
        className="w-full rounded border border-dashed border-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:border-accent-hover hover:text-text-primary"
      >
        + New Connection
      </button>

      <div className="max-h-[300px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">
            {connections.length === 0
              ? "No saved connections"
              : "No connections match your search"}
          </p>
        ) : (
          filtered.map((c) => {
            const profile = resolveColorProfile(
              c.colorProfileId,
              customProfiles,
              c.color
            );
            const isSelected = selectedConnection?.id === c.id;
            return (
              <div
                key={c.id}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded px-2 py-1.5 hover:bg-bg-tertiary"
                style={
                  isSelected
                    ? {
                        backgroundColor: profile.background,
                        color: profile.foreground,
                      }
                    : undefined
                }
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className="grid min-w-0 grid-cols-[12px_minmax(0,1fr)] items-center gap-2 rounded text-left focus:outline-none focus:ring-1 focus:ring-accent-hover"
                  onClick={() => handleClick(c)}
                  onDoubleClick={() => handleDoubleClick(c)}
                  onContextMenu={(event) => handleContextMenu(event, c)}
                >
                  <ColorProfileMarker profile={profile} size="md" />
                  <span className="min-w-0">
                    <span
                      className="block break-words text-sm font-medium leading-4 text-text-primary [overflow-wrap:anywhere]"
                      style={
                        isSelected ? { color: profile.foreground } : undefined
                      }
                    >
                      {getEffectiveAlias(c)}
                    </span>
                    <span
                      className="mt-0.5 block break-words text-xs leading-4 text-text-secondary [overflow-wrap:anywhere]"
                      style={
                        isSelected ? { color: profile.foreground } : undefined
                      }
                    >
                      {c.serverName}
                      {c.database ? ` / ${c.database}` : ""}
                      {c.username ? ` — ${c.username}` : ""}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 items-start gap-1">
                  <span
                    className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-secondary"
                    style={
                      isSelected
                        ? {
                            backgroundColor: profile.background,
                            color: profile.foreground,
                          }
                        : undefined
                    }
                  >
                    {AUTH_TYPE_LABELS[c.authType] || c.authType}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${getEffectiveAlias(c)}`}
                    title="Delete connection"
                    onClick={() => handleDelete(c)}
                    className="rounded p-0.5 text-text-secondary opacity-0 hover:text-error focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-accent-hover group-hover:opacity-100"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <line x1="4" y1="4" x2="12" y2="12" />
                      <line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmLabel={confirmAction?.confirmLabel ?? "Continue"}
        danger={confirmAction?.danger}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
