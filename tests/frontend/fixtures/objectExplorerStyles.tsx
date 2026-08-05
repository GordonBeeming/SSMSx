import { createRoot } from "react-dom/client";
import { ObjectExplorerTree } from "../../../src/features/explorer/components/ObjectExplorerTree";
import { useConnectionStore } from "../../../src/features/connection/store/connectionStore";
import { useExplorerStore } from "../../../src/features/explorer/store/explorerStore";
import { useSettingsStore } from "../../../src/features/settings/store/settingsStore";
import type { CustomColorProfile } from "../../../src/features/settings/types";
import "../../../src/index.css";

const nightProfile: CustomColorProfile = {
  id: "night",
  name: "Night",
  background: "#000000",
  foreground: "#FFFFFF",
  builtIn: false,
};

const boundaryProfile: CustomColorProfile = {
  id: "boundary",
  name: "Boundary",
  background: "#FFFFFF",
  foreground: "#767676",
  builtIn: false,
};

useSettingsStore.setState({
  settings: {
    explorer: { groupTablesBySchema: true },
    workspace: { persistQueryTabs: true },
    connections: { colorProfiles: [nightProfile, boundaryProfile] },
  },
});

useConnectionStore.setState({
  connections: [
    {
      id: "production",
      name: "Production",
      serverName: "sql-production",
      authType: "SqlAuth",
      encrypt: "Mandatory",
      trustServerCertificate: false,
      colorProfileId: "night",
      createdAt: "2026-08-05T00:00:00Z",
    },
    {
      id: "reporting",
      name: "Reporting",
      serverName: "sql-reporting",
      authType: "SqlAuth",
      encrypt: "Mandatory",
      trustServerCertificate: false,
      colorProfileId: "boundary",
      createdAt: "2026-08-05T00:00:00Z",
    },
  ],
  selectedConnection: null,
  activeConnectionIds: ["production", "reporting"],
  error: null,
});

useExplorerStore.setState({
  nodes: {
    "production/server": {
      id: "production/server",
      connectionId: "production",
      type: "server",
      name: "Production",
      expanded: true,
      loading: false,
      loaded: true,
      children: ["production/master"],
      parentId: null,
      hasChildren: true,
    },
    "production/master": {
      id: "production/master",
      connectionId: "production",
      type: "database",
      name: "master",
      expanded: false,
      loading: false,
      loaded: false,
      children: [],
      parentId: "production/server",
      hasChildren: false,
    },
    "reporting/server": {
      id: "reporting/server",
      connectionId: "reporting",
      type: "server",
      name: "Reporting",
      expanded: true,
      loading: false,
      loaded: true,
      children: ["reporting/warehouse"],
      parentId: null,
      hasChildren: true,
    },
    "reporting/warehouse": {
      id: "reporting/warehouse",
      connectionId: "reporting",
      type: "database",
      name: "warehouse",
      expanded: false,
      loading: false,
      loaded: false,
      children: [],
      parentId: "reporting/server",
      hasChildren: false,
    },
  },
  rootNodeIds: ["production/server", "reporting/server"],
  selectedNodeId: "reporting/warehouse",
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Object Explorer fixture root is missing.");
}

root.style.height = "480px";
createRoot(root).render(<ObjectExplorerTree />);
