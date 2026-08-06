export type SettingValue = boolean | string;

export interface BooleanSettingDefinition {
  id: string;
  category: string;
  title: string;
  description: string;
  keywords: string[];
  type: "boolean";
  defaultValue: boolean;
}

export interface TemplateSettingDefinition {
  id: string;
  category: string;
  title: string;
  description: string;
  keywords: string[];
  type: "template";
  defaultValue: string;
}

export type SettingDefinition =
  | BooleanSettingDefinition
  | TemplateSettingDefinition;

export interface AppSettings {
  explorer: {
    groupTablesBySchema: boolean;
  };
  workspace: {
    persistQueryTabs: boolean;
  };
  queryEditor: {
    newQueryTemplate: string;
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
