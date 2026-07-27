import type { ConnectionInfo } from "../features/connection/types";
import type { ColorProfile, CustomColorProfile } from "../features/settings/types";

export const RED_COLOR_PROFILE_ID = "red";

export const BUILT_IN_COLOR_PROFILES: readonly ColorProfile[] = [
  { id: "red", name: "Red", background: "#FEF2F2", foreground: "#991B1B", builtIn: true },
  { id: "blue", name: "Blue", background: "#EFF6FF", foreground: "#1D4ED8", builtIn: true },
  { id: "green", name: "Green", background: "#F0FDF4", foreground: "#166534", builtIn: true },
  { id: "amber", name: "Amber", background: "#FFFBEB", foreground: "#92400E", builtIn: true },
  { id: "violet", name: "Violet", background: "#F5F3FF", foreground: "#6D28D9", builtIn: true },
  { id: "slate", name: "Slate", background: "#F8FAFC", foreground: "#334155", builtIn: true },
] as const;

const LEGACY_FOREGROUND_IDS: Record<string, string> = {
  "#dc2626": "red", "#991b1b": "red", "#0063b2": "blue", "#1d4ed8": "blue",
  "#16a34a": "green", "#166534": "green", "#d97706": "amber", "#92400e": "amber",
  "#7c3aed": "violet", "#6d28d9": "violet", "#555555": "slate", "#334155": "slate",
  "#22c55e": "green", "#ef4444": "red", "#3b82f6": "blue", "#eab308": "amber",
  "#f97316": "amber", "#a855f7": "violet", "#ff0000": "red",
};

export function getEffectiveAlias(connection: Pick<ConnectionInfo, "name" | "serverName">): string {
  return typeof connection.name === "string" && connection.name.trim()
    ? connection.name.trim()
    : connection.serverName;
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(background: string, foreground: string): number {
  if (!isValidHexColor(background) || !isValidHexColor(foreground)) return 0;
  const [lighter, darker] = [relativeLuminance(background), relativeLuminance(foreground)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateCustomColorProfile(profile: Pick<CustomColorProfile, "name" | "background" | "foreground">, existing: readonly CustomColorProfile[] = [], excludedId?: string): string | null {
  if (!profile.name.trim()) return "Profile name is required.";
  if (BUILT_IN_COLOR_PROFILES.some((item) => item.name.toLowerCase() === profile.name.trim().toLowerCase())) return "Profile names cannot use a built-in name.";
  if (existing.some((item) => item.id !== excludedId && item.name.trim().toLowerCase() === profile.name.trim().toLowerCase())) return "Profile names must be unique.";
  if (!isValidHexColor(profile.background) || !isValidHexColor(profile.foreground)) return "Use six-digit hex colours, for example #FEF2F2.";
  if (contrastRatio(profile.background, profile.foreground) < 4.5) return "Foreground and background must meet 4.5:1 contrast.";
  return null;
}

export function normalizeCustomColorProfiles(value: unknown): CustomColorProfile[] {
  if (!Array.isArray(value)) return [];
  const profiles: CustomColorProfile[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const profile = item as Partial<CustomColorProfile>;
    if (typeof profile.id !== "string" || !profile.id || typeof profile.name !== "string" || typeof profile.background !== "string" || typeof profile.foreground !== "string") continue;
    if (BUILT_IN_COLOR_PROFILES.some((builtIn) => builtIn.id === profile.id) || profiles.some((existing) => existing.id === profile.id)) continue;
    const candidate: CustomColorProfile = {
      id: profile.id,
      name: profile.name.trim(),
      background: profile.background.toUpperCase(),
      foreground: profile.foreground.toUpperCase(),
      builtIn: false,
    };
    if (validateCustomColorProfile(candidate, profiles, candidate.id)) continue;
    profiles.push(candidate);
  }
  return profiles;
}

export function normalizeColorProfileId(profileId: unknown, legacyColor?: unknown): string {
  if (typeof profileId === "string" && profileId.trim()) return profileId.trim();
  if (typeof legacyColor === "string") return LEGACY_FOREGROUND_IDS[legacyColor.toLowerCase()] ?? RED_COLOR_PROFILE_ID;
  return RED_COLOR_PROFILE_ID;
}

export function resolveColorProfile(profileId: string | undefined, customProfiles: readonly CustomColorProfile[] = [], legacyColor?: string): ColorProfile {
  const normalized = normalizeColorProfileId(profileId, legacyColor);
  return BUILT_IN_COLOR_PROFILES.find((item) => item.id === normalized)
    ?? customProfiles.find((item) => item.id === normalized)
    ?? BUILT_IN_COLOR_PROFILES[0];
}

export function profileIdForConnection(connection: Pick<ConnectionInfo, "colorProfileId" | "color">): string {
  return normalizeColorProfileId(connection.colorProfileId, connection.color);
}

export function buildDeleteProfileUpdates<T extends Pick<ConnectionInfo, "colorProfileId">>(profileId: string, connections: readonly T[]): T[] {
  return connections.filter((connection) => connection.colorProfileId === profileId).map((connection) => ({ ...connection, colorProfileId: RED_COLOR_PROFILE_ID }));
}

export function shouldSaveConnectionChange({ isNewConnection, formDirty, hasNewPassword, rememberPassword }: { isNewConnection: boolean; formDirty: boolean; hasNewPassword: boolean; rememberPassword: boolean }): boolean {
  return isNewConnection || formDirty || hasNewPassword || !rememberPassword;
}
