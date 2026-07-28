import { useState, useCallback, useMemo } from "react";
import { Pin } from "lucide-react";
import { useQueryStore } from "../store/queryStore";
import { ContextMenu, type ContextMenuItem } from "../../../shared/components/ContextMenu";
import { useConnectionStore } from "../../connection";
import { useSettingsStore } from "../../settings";
import { resolveColorProfile } from "../../../shared/connectionAppearance";
import { partitionQueryTabs } from "../utils/queryTabs";
import type { QueryTab } from "../types";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const NEW_QUERY_SHORTCUT = isMac ? "⌘+N" : "Ctrl+N";

export function QueryTabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab, closeOtherTabs, closeAllTabs, setTabPinned } =
    useQueryStore();
  const isTabDirty = useQueryStore((s) => s.isTabDirty);
  const connections = useConnectionStore((state) => state.connections);
  const customProfiles = useSettingsStore((state) => state.settings.connections.colorProfiles);
  const tabBands = useMemo(() => partitionQueryTabs(tabs), [tabs]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    []
  );

  const handleMiddleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleAuxClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      removeTab(tabId);
    },
    [removeTab]
  );

  const contextMenuItems: ContextMenuItem[] = contextMenu
    ? [
        {
          type: "action",
          label: tabs.find((tab) => tab.id === contextMenu.tabId)?.pinned
            ? "Unpin Tab"
            : "Pin Tab",
          onClick: () => {
            const tab = tabs.find((item) => item.id === contextMenu.tabId);
            if (tab) setTabPinned(tab.id, tab.pinned !== true);
          },
        },
        { type: "separator" },
        {
          type: "action",
          label: "Close",
          onClick: () => removeTab(contextMenu.tabId),
        },
        {
          type: "action",
          label: "Close Others",
          onClick: () => closeOtherTabs(contextMenu.tabId),
          disabled: tabs.length <= 1,
        },
        {
          type: "action",
          label: "Close All",
          onClick: () => closeAllTabs(),
          danger: true,
        },
      ]
    : [];

  const renderTab = (tab: QueryTab) => {
    const dirty = isTabDirty(tab.id);
    const isActive = tab.id === activeTabId;
    const connection = connections.find((item) => item.id === tab.connectionId);
    const profile = connection
      ? resolveColorProfile(connection.colorProfileId, customProfiles, connection.color)
      : null;

    return (
      <div
        key={tab.id}
        className={`group flex max-w-[200px] flex-none items-center gap-1.5 border-r border-bg-tertiary px-3 py-1.5 text-xs ${profile ? "" : isActive ? "bg-bg-primary text-text-primary" : "text-text-secondary hover:bg-bg-tertiary"}`}
        style={profile ? {
          backgroundColor: profile.background,
          color: profile.foreground,
          ...(isActive
            ? {
                borderBottomColor: profile.foreground,
                borderBottomStyle: "solid",
                borderBottomWidth: 2,
              }
            : {}),
        } : undefined}
        onContextMenu={(event) => handleContextMenu(event, tab.id)}
        onMouseDown={handleMiddleMouseDown}
        onAuxClick={(event) => handleAuxClick(event, tab.id)}
      >
        {tab.pinned && (
          <button
            type="button"
            className="shrink-0 text-text-secondary hover:text-text-primary"
            style={profile ? { color: profile.foreground } : undefined}
            onClick={(event) => {
              event.stopPropagation();
              setTabPinned(tab.id, false);
            }}
            title="Unpin tab"
            aria-label={`Unpin ${tab.title}`}
          >
            <Pin size={11} fill="currentColor" />
          </button>
        )}
        <button
          className="min-w-0 truncate"
          onClick={() => setActiveTab(tab.id)}
          title={`${tab.database} — ${tab.title}`}
        >
          {tab.kind === "diagram" ? "Diagram — " : tab.database ? `${tab.database} — ` : ""}
          {tab.title}
        </button>
        {dirty && (
          <span className="shrink-0 text-text-secondary" style={profile ? { color: profile.foreground } : undefined} title="Unsaved changes">
            &bull;
          </span>
        )}
        <button
          className="ml-0.5 shrink-0 text-text-secondary opacity-0 hover:text-text-primary group-hover:opacity-100 focus:opacity-100"
          style={profile ? { color: profile.foreground } : undefined}
          onClick={(event) => {
            event.stopPropagation();
            removeTab(tab.id);
          }}
          title="Close tab"
          aria-label={`Close ${tab.title}`}
        >
          &times;
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col border-b border-bg-tertiary bg-bg-secondary">
        {tabBands.pinned.length > 0 && (
          <div
            aria-label="Pinned query tabs"
            className="flex flex-wrap items-center border-b border-bg-tertiary"
          >
            {tabBands.pinned.map(renderTab)}
          </div>
        )}
        <div aria-label="Query tabs" className="flex flex-wrap items-center">
          {tabBands.unpinned.map(renderTab)}
          <button
            className="px-2.5 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("query:new-tab"));
            }}
            title={`New Query (${NEW_QUERY_SHORTCUT})`}
          >
            +
          </button>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
