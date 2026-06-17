import type { AppSettings, SettingDefinition } from "./types";

export const defaultSettings: AppSettings = {
  explorer: {
    groupTablesBySchema: true,
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
];
