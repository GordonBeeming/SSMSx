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
  workspace: {
    persistQueryTabs: boolean;
  };
  connections: {
    colorProfiles: CustomColorProfile[];
  };
}

export interface ColorProfile {
  id: string;
  name: string;
  background: string;
  foreground: string;
  builtIn: boolean;
}

export interface CustomColorProfile extends ColorProfile {
  builtIn: false;
}
