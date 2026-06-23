import { useState, useCallback } from "react";
import { useQueryStore } from "../store/queryStore";
import { ContextMenu, type ContextMenuItem } from "../../../shared/components/ContextMenu";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const NEW_QUERY_SHORTCUT = isMac ? "⌘+N" : "Ctrl+N";

export function QueryTabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab, closeOtherTabs, closeAllTabs } =
    useQueryStore();
  const isTabDirty = useQueryStore((s) => s.isTabDirty);

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

  const handleAuxClose = useCallback(
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

  return (
    <>
      <div className="flex items-center border-b border-bg-tertiary bg-bg-secondary">
        {tabs.map((tab) => {
          const dirty = isTabDirty(tab.id);
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              className={`group flex max-w-[200px] items-center gap-1.5 border-r border-bg-tertiary px-3 py-1.5 text-xs ${
                isActive
                  ? "bg-bg-primary text-text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary"
              }`}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onMouseDown={(e) => handleAuxClose(e, tab.id)}
              onAuxClick={(e) => handleAuxClose(e, tab.id)}
            >
              {tab.connectionColor && (
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tab.connectionColor }}
                />
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
                <span className="shrink-0 text-text-secondary" title="Unsaved changes">
                  &bull;
                </span>
              )}
              <button
                className="ml-0.5 shrink-0 text-text-secondary opacity-0 hover:text-text-primary group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                title="Close tab"
              >
                &times;
              </button>
            </div>
          );
        })}

        <button
          className="px-2.5 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          onClick={() => {
            // Dispatch a custom event that the app can handle for new tab creation
            window.dispatchEvent(new CustomEvent("query:new-tab"));
          }}
          title={`New Query (${NEW_QUERY_SHORTCUT})`}
        >
          +
        </button>
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
