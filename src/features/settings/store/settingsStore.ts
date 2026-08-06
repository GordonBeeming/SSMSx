import { create } from "zustand";
import type { AppSettings, CustomColorProfile } from "../types";
import { defaultSettings } from "../settingsSchema";
import {
  BUILT_IN_COLOR_PROFILES,
  normalizeCustomColorProfiles,
  validateCustomColorProfile,
} from "../../../shared/connectionAppearance";
import { hasAtMostOneCursorMarker } from "../../query/utils/newQueryTemplate";

export const SETTINGS_STORAGE_KEY = "ssmsx.settings";
export const SAVE_SETTINGS_ERROR =
  "Could not save settings. Check that local storage is available, then try again.";

interface SettingsState {
  settings: AppSettings;
  setGroupTablesBySchema: (value: boolean) => string | null;
  setPersistQueryTabs: (value: boolean) => string | null;
  setNewQueryTemplate: (value: string) => string | null;
  saveColorProfiles: (profiles: CustomColorProfile[]) => string | null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readColorProfiles(value: unknown): CustomColorProfile[] {
  return normalizeCustomColorProfiles(value);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNewQueryTemplate(value: unknown, fallback: string): string {
  const template = readString(value, fallback);
  return hasAtMostOneCursorMarker(template) ? template : fallback;
}

function readProperty(value: unknown, property: string): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !Object.prototype.hasOwnProperty.call(value, property)
  ) {
    return undefined;
  }

  return Reflect.get(value, property);
}

export function loadSettings(): AppSettings {
  try {
    const storedValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!storedValue) return defaultSettings;

    const parsed: unknown = JSON.parse(storedValue);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return defaultSettings;
    }

    const explorer = readProperty(parsed, "explorer");
    const workspace = readProperty(parsed, "workspace");
    const queryEditor = readProperty(parsed, "queryEditor");
    const connections = readProperty(parsed, "connections");

    return {
      explorer: {
        groupTablesBySchema: readBoolean(
          readProperty(explorer, "groupTablesBySchema"),
          defaultSettings.explorer.groupTablesBySchema
        ),
      },
      workspace: {
        persistQueryTabs: readBoolean(
          readProperty(workspace, "persistQueryTabs"),
          defaultSettings.workspace.persistQueryTabs
        ),
      },
      queryEditor: {
        newQueryTemplate: readNewQueryTemplate(
          readProperty(queryEditor, "newQueryTemplate"),
          defaultSettings.queryEditor.newQueryTemplate
        ),
      },
      connections: {
        colorProfiles: readColorProfiles(readProperty(connections, "colorProfiles")),
      },
    };
  } catch (cause) {
    console.warn("Failed to load settings:", cause);
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): string | null {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return null;
  } catch (cause) {
    console.error("Failed to save settings:", cause);
    return SAVE_SETTINGS_ERROR;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),

  setGroupTablesBySchema: (value) => {
    const current = get().settings;
    const settings: AppSettings = {
      ...current,
      explorer: {
        ...current.explorer,
        groupTablesBySchema: value,
      },
    };
    const saveError = saveSettings(settings);
    if (saveError) return saveError;
    set({ settings });
    return null;
  },

  setPersistQueryTabs: (value) => {
    const current = get().settings;
    const settings: AppSettings = {
      ...current,
      workspace: {
        ...current.workspace,
        persistQueryTabs: value,
      },
    };
    const saveError = saveSettings(settings);
    if (saveError) return saveError;
    set({ settings });
    return null;
  },

  setNewQueryTemplate: (value) => {
    if (!hasAtMostOneCursorMarker(value)) {
      return "New query templates can contain at most one {{cursor}} marker.";
    }

    const current = get().settings;
    const settings: AppSettings = {
      ...current,
      queryEditor: {
        ...current.queryEditor,
        newQueryTemplate: value,
      },
    };
    const saveError = saveSettings(settings);
    if (saveError) return saveError;
    set({ settings });
    return null;
  },

  saveColorProfiles: (profiles) => {
    const normalized: CustomColorProfile[] = [];
    for (const profile of profiles) {
      if (
        BUILT_IN_COLOR_PROFILES.some((builtIn) => builtIn.id === profile.id) ||
        normalized.some((existing) => existing.id === profile.id)
      ) {
        return "Profile IDs must be unique and cannot use a built-in ID.";
      }
      const error = validateCustomColorProfile(profile, normalized, profile.id);
      if (error) return error;
      normalized.push({
        ...profile,
        name: profile.name.trim(),
        background: profile.background.toUpperCase(),
        foreground: profile.foreground.toUpperCase(),
        builtIn: false,
      });
    }

    const current = get().settings;
    const settings: AppSettings = {
      ...current,
      connections: {
        ...current.connections,
        colorProfiles: normalized,
      },
    };
    const saveError = saveSettings(settings);
    if (saveError) return saveError;
    set({ settings });
    return null;
  },
}));
