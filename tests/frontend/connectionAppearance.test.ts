import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILT_IN_COLOR_PROFILES,
  buildDeleteProfileUpdates,
  contrastRatio,
  getEffectiveAlias,
  normalizeColorProfileId,
  normalizeCustomColorProfiles,
  resolveColorProfile,
  shouldSaveConnectionChange,
  validateCustomColorProfile,
} from "../../src/shared/connectionAppearance.ts";

test("effective alias is trimmed and falls back to server name", () => {
  assert.equal(getEffectiveAlias({ name: "  Prod  ", serverName: "sql01" }), "Prod");
  assert.equal(getEffectiveAlias({ name: "  ", serverName: "sql01" }), "sql01");
  assert.equal(getEffectiveAlias({ name: undefined, serverName: "sql01" }), "sql01");
  assert.equal(getEffectiveAlias({ name: null, serverName: "sql01" }), "sql01");
});

test("profiles resolve built-ins, custom entries, and missing IDs", () => {
  const custom = { id: "customer", name: "Customer", background: "#FFFFFF", foreground: "#1A1A1A", builtIn: false as const };
  assert.equal(resolveColorProfile("blue").name, "Blue");
  assert.equal(resolveColorProfile("customer", [custom]).name, "Customer");
  assert.equal(resolveColorProfile("gone", [custom]).id, "red");
  assert.equal(BUILT_IN_COLOR_PROFILES[0].id, "red");
});

test("historic picker values map to built-in IDs", () => {
  for (const [hex, id] of Object.entries({ "#22c55e": "green", "#ef4444": "red", "#3b82f6": "blue", "#eab308": "amber", "#f97316": "amber", "#a855f7": "violet", "#FF0000": "red" })) assert.equal(normalizeColorProfileId(undefined, hex), id);
});

test("custom profiles require unique names, valid hex, and AA contrast", () => {
  const existing = [{ id: "one", name: "Prod", background: "#FEF2F2", foreground: "#991B1B", builtIn: false as const }];
  assert.equal(validateCustomColorProfile({ name: "prod", background: "#FFFFFF", foreground: "#111111" }, existing), "Profile names must be unique.");
  assert.equal(validateCustomColorProfile({ name: "Local", background: "red", foreground: "#111111" }, existing), "Use six-digit hex colours, for example #FEF2F2.");
  assert.equal(validateCustomColorProfile({ name: "Local", background: "#FFFFFF", foreground: "#AAAAAA" }, existing), "Foreground and background must meet 4.5:1 contrast.");
  assert.ok(contrastRatio("#FFFFFF", "#1A1A1A") >= 4.5);
});

test("settings migration keeps only valid, non-colliding custom profiles", () => {
  assert.deepEqual(normalizeCustomColorProfiles([
    { id: "prod", name: "Production", background: "#FEF2F2", foreground: "#991B1B" },
    { id: "duplicate", name: " production ", background: "#FFFFFF", foreground: "#111111" },
    { id: "red", name: "Not allowed", background: "#FFFFFF", foreground: "#111111" },
    { id: "bad", name: "Bad", background: "#FFFFFF", foreground: "#AAAAAA" },
  ]), [{ id: "prod", name: "Production", background: "#FEF2F2", foreground: "#991B1B", builtIn: false }]);
});

test("deleting a profile reassigns only linked connections to Red", () => {
  assert.deepEqual(buildDeleteProfileUpdates("custom", [{ id: "a", colorProfileId: "custom" }, { id: "b", colorProfileId: "blue" }]), [{ id: "a", colorProfileId: "red" }]);
});

test("appearance-only edits save before connecting", () => {
  assert.equal(shouldSaveConnectionChange({ isNewConnection: false, formDirty: true, hasNewPassword: false, rememberPassword: true }), true);
  assert.equal(shouldSaveConnectionChange({ isNewConnection: false, formDirty: false, hasNewPassword: false, rememberPassword: true }), false);
});
