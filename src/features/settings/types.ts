export type SettingValue = boolean;

export interface SettingDefinition {
  id: string;
  category: string;
  title: string;
  description: string;
  keywords: string[];
  type: "boolean";
  defaultValue: boolean;
}

export interface AppSettings {
  explorer: {
    groupTablesBySchema: boolean;
  };
}
