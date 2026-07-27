import { create } from "zustand";
import type { AppSettings, CustomColorProfile } from "../types";
import { defaultSettings } from "../settingsSchema";
import {
  normalizeCustomColorProfiles,
  validateCustomColorProfile,
} from "../../../shared/connectionAppearance";

export const SETTINGS_STORAGE_KEY = "ssmsx.settings";
export const SAVE_SETTINGS_ERROR =
  "Could not save settings. Check that local storage is available, then try again.";

interface SettingsState {
  settings: AppSettings;
  setGroupTablesBySchema: (value: boolean) => string | null;
  setPersistQueryTabs: (value: boolean) => string | null;
  saveColorProfiles: (profiles: CustomColorProfile[]) => string | null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readColorProfiles(value: unknown): CustomColorProfile[] {
  return normalizeCustomColorProfiles(value);
}

export function loadSettings(): AppSettings {
  try {
    const storedValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!storedValue) return defaultSettings;

    const parsed = JSON.parse(storedValue) as Partial<AppSettings> | null;
    if (!parsed || typeof parsed !== "object") return defaultSettings;

    return {
      explorer: {
        groupTablesBySchema: readBoolean(
          parsed.explorer?.groupTablesBySchema,
          defaultSettings.explorer.groupTablesBySchema
        ),
      },
      workspace: {
        persistQueryTabs: readBoolean(
          parsed.workspace?.persistQueryTabs,
          defaultSettings.workspace.persistQueryTabs
        ),
      },
      connections: {
        colorProfiles: readColorProfiles(parsed.connections?.colorProfiles),
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

  saveColorProfiles: (profiles) => {
    const normalized: CustomColorProfile[] = [];
    for (const profile of profiles) {
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
