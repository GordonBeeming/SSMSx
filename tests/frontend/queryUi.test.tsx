// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryResultsTable } from "../../src/features/query/components/QueryResultsTable";
import { QueryTabBar } from "../../src/features/query/components/QueryTabBar";
import { QueryPanel } from "../../src/features/query/components/QueryPanel";
import { ObjectExplorerTree } from "../../src/features/explorer/components/ObjectExplorerTree";
import { useQueryStore } from "../../src/features/query/store/queryStore";
import { useExplorerStore } from "../../src/features/explorer/store/explorerStore";
import type { QueryResult, QueryTab } from "../../src/features/query/types";
import { useConnectionStore } from "../../src/features/connection/store/connectionStore";
import { useSettingsStore } from "../../src/features/settings/store/settingsStore";
import type { CustomColorProfile } from "../../src/features/settings/types";

vi.mock("@monaco-editor/react", () => ({
  default: () => <div data-testid="monaco-editor" />,
}));

const nightProfile: CustomColorProfile = {
  id: "night",
  name: "Night",
  background: "#000000",
  foreground: "#FFFFFF",
  builtIn: false,
};

const tabs: QueryTab[] = [
  {
    id: "unpinned",
    connectionId: "prod",
    database: "master",
    title: "Query 1",
    pinned: false,
  },
  {
    id: "pinned",
    connectionId: "prod",
    database: "app",
    title: "Query 2",
    pinned: true,
  },
];

function resetStores() {
  window.localStorage.clear();
  useQueryStore.setState({
    tabs: [],
    activeTabId: null,
    tabSql: {},
    executionInfo: {},
    results: {},
    intellisenseCache: {},
  });
  useConnectionStore.setState({
    connections: [],
    selectedConnection: null,
    activeConnectionIds: [],
    error: null,
  });
  useExplorerStore.setState({
    nodes: {},
    rootNodeIds: [],
    selectedNodeId: null,
  });
  useSettingsStore.setState({
    settings: {
      explorer: { groupTablesBySchema: true },
      workspace: { persistQueryTabs: true },
      connections: { colorProfiles: [nightProfile] },
    },
  });
}

beforeEach(resetStores);
afterEach(cleanup);

describe("query tab session and profile colours", () => {
  it("round-trips pinned tabs, ordering, SQL, and the active tab through localStorage", () => {
    useQueryStore.setState({
      tabs,
      activeTabId: "unpinned",
      tabSql: {
        pinned: "select 2",
        unpinned: "select 1",
        stale: "not part of the session",
      },
    });

    useQueryStore.getState().saveSession();
    useQueryStore.setState({ tabs: [], activeTabId: null, tabSql: {} });

    expect(useQueryStore.getState().restoreSavedSession()).toBe(true);
    expect(
      useQueryStore.getState().tabs.map(({ id, pinned }) => ({ id, pinned }))
    ).toEqual([
      { id: "unpinned", pinned: false },
      { id: "pinned", pinned: true },
    ]);
    expect(useQueryStore.getState().activeTabId).toBe("unpinned");
    expect(useQueryStore.getState().tabSql).toEqual({
      unpinned: "select 1",
      pinned: "select 2",
    });
  });

  it("renders wrapping tab bands with both profile colours on active and inactive tabs", () => {
    useConnectionStore.setState({
      connections: [
        {
          id: "prod",
          name: "Production",
          serverName: "sql-prod",
          authType: "SqlAuth",
          encrypt: "Mandatory",
          trustServerCertificate: false,
          colorProfileId: "night",
          createdAt: "2026-07-27T00:00:00Z",
        },
      ],
    });
    useQueryStore.setState({
      tabs,
      activeTabId: "pinned",
      tabSql: { pinned: "", unpinned: "" },
    });

    const view = render(<QueryTabBar />);
    expect(screen.getByLabelText("Pinned query tabs").className).toContain(
      "flex-wrap"
    );
    expect(screen.getByLabelText("Query tabs").className).toContain(
      "flex-wrap"
    );

    expect(view.container.querySelectorAll("[data-profile-marker]")).toHaveLength(0);
    for (const title of ["master — Query 1", "app — Query 2"]) {
      const tab = screen.getByTitle(title).parentElement as HTMLElement;
      expect(tab.style.backgroundColor).toBe("rgb(0, 0, 0)");
      expect(tab.style.color).toBe("rgb(255, 255, 255)");
    }
    expect(
      screen.getByTitle("app — Query 2").parentElement?.style.borderBottomStyle
    ).toBe("solid");
  });

  it("colours only the active query editor gutter from its connection profile", () => {
    useConnectionStore.setState({
      connections: [
        {
          id: "prod",
          name: "Production",
          serverName: "sql-prod",
          authType: "SqlAuth",
          encrypt: "Mandatory",
          trustServerCertificate: false,
          colorProfileId: "night",
          createdAt: "2026-07-27T00:00:00Z",
        },
      ],
    });
    useQueryStore.setState({
      tabs: [tabs[0]],
      activeTabId: "unpinned",
      tabSql: { unpinned: "select 1" },
    });

    render(<QueryPanel />);

    const editor = screen.getByTestId("query-editor");
    expect(editor.style.getPropertyValue("--query-gutter-background")).toBe(
      "#000000"
    );
    expect(editor.style.getPropertyValue("--query-gutter-foreground")).toBe(
      "#FFFFFF"
    );
    expect(editor.style.backgroundColor).toBe("");
  });
});

describe("object explorer profile colours", () => {
  it("uses the selected node connection background for the explorer pane", () => {
    useConnectionStore.setState({
      connections: [
        {
          id: "prod",
          name: "Production",
          serverName: "sql-prod",
          authType: "SqlAuth",
          encrypt: "Mandatory",
          trustServerCertificate: false,
          colorProfileId: "night",
          createdAt: "2026-07-27T00:00:00Z",
        },
      ],
    });
    useExplorerStore.setState({
      nodes: {
        "prod/server": {
          id: "prod/server",
          connectionId: "prod",
          type: "server",
          name: "Production",
          expanded: false,
          loading: false,
          loaded: false,
          children: [],
          parentId: null,
          hasChildren: true,
        },
      },
      rootNodeIds: ["prod/server"],
      selectedNodeId: "prod/server",
    });

    render(<ObjectExplorerTree />);

    expect(screen.getByTestId("object-explorer").style.backgroundColor).toBe(
      "rgb(0, 0, 0)"
    );
    expect(screen.getByTestId("object-explorer").style.color).toBe(
      "rgb(255, 255, 255)"
    );
    expect(screen.getByTestId("object-explorer").style.getPropertyValue(
      "--object-explorer-foreground"
    )).toBe("#FFFFFF");
    expect(screen.getByTestId("object-explorer").style.getPropertyValue(
      "--color-text-primary"
    )).toBe("");
  });
});

describe("query results layout and resizing", () => {
  const result: QueryResult = {
    resultSets: [
      {
        columns: [
          { name: "Payload", dataType: "nvarchar(max)", isNullable: false },
        ],
        rows: [["x".repeat(1000)]],
        totalRows: 1,
      },
    ],
    columns: [],
    rows: [],
    messages: [{ text: "Completed", severity: "info" }],
    executionTimeMs: 4,
    totalRows: 1,
  };

  it("wraps fully coloured result tabs and caps long columns at 500px", () => {
    const view = render(
      <QueryResultsTable result={result} profile={nightProfile} tabId="query" />
    );

    expect(screen.getByTestId("result-tab-strip").className).toContain(
      "flex-wrap"
    );
    expect(screen.getByLabelText("Query result tabs").className).toContain(
      "flex-wrap"
    );
    expect(view.container.querySelectorAll("[data-profile-marker]")).toHaveLength(0);
    for (const name of ["Results (1)", "Messages (1)"]) {
      const tab = screen.getByRole("button", { name });
      expect(tab.style.backgroundColor).toBe("rgb(0, 0, 0)");
      expect(tab.style.color).toBe("rgb(255, 255, 255)");
    }
    expect(view.container.querySelector("col")?.style.width).toBe("500px");
    expect(screen.getByRole("columnheader").className).toContain(
      "max-w-[500px]"
    );
    expect(screen.getByRole("gridcell").className).toContain("max-w-[500px]");
    expect(screen.getByRole("gridcell").getAttribute("title")).toHaveLength(
      1000
    );
  });

  it("resizes columns from the keyboard with separator value semantics", () => {
    const view = render(
      <QueryResultsTable result={result} profile={nightProfile} tabId="query" />
    );
    const separator = screen.getByRole("separator", {
      name: "Resize Payload column",
    });
    const column = view.container.querySelector("col");

    expect(separator.getAttribute("aria-valuemin")).toBe("80");
    expect(separator.getAttribute("aria-valuemax")).toBe("500");
    expect(separator.getAttribute("aria-valuenow")).toBe("500");

    fireEvent.keyDown(separator, { key: "Home" });
    expect(column?.style.width).toBe("80px");
    expect(separator.getAttribute("aria-valuenow")).toBe("80");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(column?.style.width).toBe("88px");
    expect(separator.getAttribute("aria-valuenow")).toBe("88");

    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    expect(column?.style.width).toBe("120px");

    fireEvent.keyDown(separator, { key: "End" });
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(column?.style.width).toBe("500px");
    expect(separator.getAttribute("aria-valuenow")).toBe("500");
  });

  it("cleans up a pointer resize when the result table unmounts", () => {
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const view = render(<QueryResultsTable result={result} profile={nightProfile} tabId="query" />);
    fireEvent.pointerDown(
      screen.getByRole("separator", { name: "Resize Payload column" }),
      { clientX: 200 }
    );

    view.unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function)
    );
  });
});
