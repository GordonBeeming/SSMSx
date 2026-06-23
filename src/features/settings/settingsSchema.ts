import type { AppSettings, SettingDefinition } from "./types";

export const defaultSettings: AppSettings = {
  explorer: {
    groupTablesBySchema: true,
  },
  workspace: {
    persistQueryTabs: true,
  },
};

export const settingsSchema: SettingDefinition[] = [
  {
    id: "explorer.groupTablesBySchema",
    category: "Object Explorer",
    title: "Show table schemas as folders",
    description:
      "Group tables under schema folders in Object Explorer. Turn this off to show a flat schema.table list.",
    keywords: ["schema", "schemas", "tables", "folders", "flat", "object explorer"],
    type: "boolean",
    defaultValue: defaultSettings.explorer.groupTablesBySchema,
  },
  {
    id: "workspace.persistQueryTabs",
    category: "Query Editor",
    title: "Persist query tabs",
    description:
      "Keep open query tabs and SQL text across app restarts. Turn this off to always start with a clean query workspace.",
    keywords: ["query", "queries", "tabs", "restore", "startup", "session", "workspace"],
    type: "boolean",
    defaultValue: defaultSettings.workspace.persistQueryTabs,
  },
];
