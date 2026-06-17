import { create } from "zustand";
import type { AppSettings } from "../types";
import { defaultSettings } from "../settingsSchema";

const SETTINGS_STORAGE_KEY = "ssmsx.settings";

interface SettingsState {
  settings: AppSettings;
  setGroupTablesBySchema: (value: boolean) => void;
}

function loadSettings(): AppSettings {
  try {
    const storedValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!storedValue) return defaultSettings;

    const parsed = JSON.parse(storedValue) as Partial<AppSettings>;
    return {
      explorer: {
        groupTablesBySchema:
          parsed.explorer?.groupTablesBySchema ??
          defaultSettings.explorer.groupTablesBySchema,
      },
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures; preferences should still work for this session.
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: loadSettings(),

  setGroupTablesBySchema: (value) =>
    set((state) => {
      const settings: AppSettings = {
        ...state.settings,
        explorer: {
          ...state.settings.explorer,
          groupTablesBySchema: value,
        },
      };
      saveSettings(settings);
      return { settings };
    }),
}));
