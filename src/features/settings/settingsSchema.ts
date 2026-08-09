import type { AppSettings, SettingDefinition } from "./types";

export const DEFAULT_NEW_QUERY_TEMPLATE = "\n{{cursor}}\n";
export const LEGACY_DEFAULT_NEW_QUERY_TEMPLATE =
  "\n".repeat(30) + "{{cursor}}";
export const NEW_QUERY_TEMPLATE_MIGRATION_VERSION = 1;

export const defaultSettings: AppSettings = {
  explorer: {
    groupTablesBySchema: true,
  },
  workspace: {
    persistQueryTabs: true,
  },
  queryEditor: {
    newQueryTemplate: DEFAULT_NEW_QUERY_TEMPLATE,
    newQueryTemplateMigrationVersion: NEW_QUERY_TEMPLATE_MIGRATION_VERSION,
  },
  connections: {
    colorProfiles: [],
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
  {
    id: "queryEditor.newQueryTemplate",
    category: "Query Editor",
    title: "New query template",
    description:
      "New queries insert this content exactly as written. Use the optional {{cursor}} marker to place the cursor.",
    keywords: ["query", "new query", "template", "cursor", "whitespace", "editor"],
    type: "template",
    defaultValue: defaultSettings.queryEditor.newQueryTemplate,
  },
];
