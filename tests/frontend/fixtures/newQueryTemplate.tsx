import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { useConnectionStore } from "../../../src/features/connection";
import { QueryPanel, QueryTabBar, useQueryStore } from "../../../src/features/query";
import { SettingsDialog, useSettingsStore } from "../../../src/features/settings";
import type { QueryTab } from "../../../src/features/query";
import "../../../src/index.css";

const CONNECTION_ID = "acceptance-connection";
const GENERATED_SQL = "SELECT name FROM sys.databases;\n";

let tabNumber = 0;

interface AcceptanceFixture {
  addGeneratedQuery: () => void;
  getActiveTab: () => QueryTab | undefined;
  getActiveSql: () => string;
  isActiveTabDirty: () => boolean;
}

declare global {
  interface Window {
    ssmsxNewQueryTemplateFixture?: AcceptanceFixture;
  }
}

useSettingsStore.setState({
  settings: {
    explorer: { groupTablesBySchema: true },
    workspace: { persistQueryTabs: false },
    queryEditor: { newQueryTemplate: "\n".repeat(30) + "{{cursor}}" },
    connections: { colorProfiles: [] },
  },
});

useConnectionStore.setState({
  connections: [
    {
      id: CONNECTION_ID,
      name: "Acceptance SQL Server",
      serverName: "localhost",
      database: "master",
      authType: "SqlAuth",
      encrypt: "Mandatory",
      trustServerCertificate: false,
      createdAt: "2026-08-05T00:00:00Z",
    },
  ],
  activeConnectionIds: [CONNECTION_ID],
  error: null,
});

function nextTab(title: string, initialSql?: string): QueryTab {
  tabNumber += 1;
  return {
    id: `acceptance-query-${tabNumber}`,
    kind: "query",
    connectionId: CONNECTION_ID,
    database: "master",
    title,
    ...(initialSql === undefined ? {} : { initialSql }),
  };
}

function AcceptanceFixtureApp() {
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    const createBlankQuery = () => {
      useQueryStore.getState().addTab(nextTab(`Query ${tabNumber + 1}`));
    };
    window.addEventListener("query:new-tab", createBlankQuery);
    return () => window.removeEventListener("query:new-tab", createBlankQuery);
  }, []);

  useEffect(() => {
    window.ssmsxNewQueryTemplateFixture = {
      addGeneratedQuery: () => {
        useQueryStore.getState().addTab(nextTab("Generated SQL", GENERATED_SQL));
      },
      getActiveTab: () => {
        const state = useQueryStore.getState();
        return state.tabs.find((tab) => tab.id === state.activeTabId);
      },
      getActiveSql: () => {
        const state = useQueryStore.getState();
        return state.activeTabId ? (state.tabSql[state.activeTabId] ?? "") : "";
      },
      isActiveTabDirty: () => {
        const state = useQueryStore.getState();
        return state.activeTabId ? state.isTabDirty(state.activeTabId) : false;
      },
    };

    return () => {
      delete window.ssmsxNewQueryTemplateFixture;
    };
  }, []);

  return (
    <main className="flex h-screen min-h-0 flex-col bg-bg-primary text-text-primary">
      <header className="flex items-center justify-between border-b border-bg-tertiary px-4 py-2">
        <h1 className="m-0 text-base font-semibold">New query template acceptance</h1>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          Open settings
        </button>
      </header>
      <QueryTabBar />
      <QueryPanel />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("New query template fixture root is missing.");
}

createRoot(root).render(<AcceptanceFixtureApp />);
