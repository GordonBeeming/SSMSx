import { useId, useMemo, useRef, useState } from "react";
import {
  BUILT_IN_COLOR_PROFILES,
  isValidHexColor,
  RED_COLOR_PROFILE_ID,
  validateCustomColorProfile,
} from "../../../shared/connectionAppearance";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import {
  connectionReassignColorProfile,
} from "../../connection/api/connectionApi";
import { useConnectionStore } from "../../connection/store/connectionStore";
import type { ColorProfile, CustomColorProfile } from "../types";
import { useSettingsStore } from "../store/settingsStore";

interface ConnectionProfilesPanelProps {
  searchQuery?: string;
}

type InvalidField = "name" | "background" | "foreground" | "colours" | null;

function emptyDraft(): CustomColorProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    background: "#FFFFFF",
    foreground: "#1A1A1A",
    builtIn: false,
  };
}

function invalidFieldFor(
  draft: CustomColorProfile,
  validationError: string
): InvalidField {
  if (!draft.name.trim() || validationError.includes("name")) return "name";
  if (!isValidHexColor(draft.background)) return "background";
  if (!isValidHexColor(draft.foreground)) return "foreground";
  if (validationError.includes("contrast")) return "colours";
  return null;
}

function matchesProfileSearch(profile: ColorProfile, query: string): boolean {
  return [profile.name, profile.background, profile.foreground]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function ConnectionProfilesPanel({
  searchQuery = "",
}: ConnectionProfilesPanelProps) {
  const profiles = useSettingsStore(
    (state) => state.settings.connections.colorProfiles
  );
  const saveColorProfiles = useSettingsStore(
    (state) => state.saveColorProfiles
  );
  const connections = useConnectionStore((state) => state.connections);
  const loadConnections = useConnectionStore((state) => state.loadConnections);
  const [draft, setDraft] = useState<CustomColorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<InvalidField>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<CustomColorProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const editorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const foregroundInputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const allProfiles = useMemo(
    () => [...BUILT_IN_COLOR_PROFILES, ...profiles],
    [profiles]
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const isGeneralProfileSearch = [
    "connection",
    "connections",
    "colour",
    "colours",
    "color",
    "colors",
    "profile",
    "profiles",
  ].some((term) => term.includes(normalizedSearch));
  const visibleProfiles =
    !normalizedSearch || isGeneralProfileSearch
      ? allProfiles
      : allProfiles.filter((profile) =>
          matchesProfileSearch(profile, normalizedSearch)
        );
  const affectedConnections = deleteCandidate
    ? connections.filter(
        (connection) => connection.colorProfileId === deleteCandidate.id
      )
    : [];

  const restoreFocus = (target: HTMLButtonElement | null) => {
    window.setTimeout(() => {
      if (target?.isConnected) {
        target.focus();
      } else {
        addButtonRef.current?.focus();
      }
    }, 0);
  };

  const closeEditor = () => {
    const trigger = editorTriggerRef.current;
    setDraft(null);
    setError(null);
    setInvalidField(null);
    restoreFocus(trigger);
  };

  const openEditor = (
    nextDraft: CustomColorProfile,
    trigger: HTMLButtonElement
  ) => {
    editorTriggerRef.current = trigger;
    setDraft(nextDraft);
    setError(null);
    setInvalidField(null);
  };

  const focusInvalidField = (field: InvalidField) => {
    const target =
      field === "name"
        ? nameInputRef.current
        : field === "background"
          ? backgroundInputRef.current
          : foregroundInputRef.current;
    window.setTimeout(() => target?.focus(), 0);
  };

  const saveDraft = () => {
    if (!draft) return;

    const validationError = validateCustomColorProfile(
      draft,
      profiles,
      draft.id
    );
    if (validationError) {
      const field = invalidFieldFor(draft, validationError);
      setError(validationError);
      setInvalidField(field);
      focusInvalidField(field);
      return;
    }

    const normalizedDraft: CustomColorProfile = {
      ...draft,
      name: draft.name.trim(),
      background: draft.background.toUpperCase(),
      foreground: draft.foreground.toUpperCase(),
      builtIn: false,
    };
    const nextProfiles = profiles.some((profile) => profile.id === draft.id)
      ? profiles.map((profile) =>
          profile.id === draft.id ? normalizedDraft : profile
        )
      : [...profiles, normalizedDraft];
    const saveError = saveColorProfiles(nextProfiles);
    if (saveError) {
      setError(saveError);
      setInvalidField(null);
      return;
    }

    closeEditor();
  };

  const finishDelete = () => {
    const trigger = deleteTriggerRef.current;
    setDeleteCandidate(null);
    restoreFocus(trigger);
  };

  const deleteProfile = async () => {
    if (!deleteCandidate || deleting) return;

    const profile = deleteCandidate;
    setDeleting(true);
    setError(null);
    setInvalidField(null);

    try {
      await connectionReassignColorProfile(
        profile.id,
        RED_COLOR_PROFILE_ID
      );
      const refreshResult = await loadConnections();
      if (!refreshResult.ok) {
        setError(
          "Connections were reassigned, but the refreshed connection list could not be loaded. The profile was not deleted; try again."
        );
        finishDelete();
        return;
      }

      const saveError = saveColorProfiles(
        profiles.filter((candidate) => candidate.id !== profile.id)
      );
      if (saveError) {
        setError(
          `${saveError} Linked connections were reassigned to Red; delete the profile again to finish.`
        );
      }
      finishDelete();
    } catch (cause) {
      console.error("Failed to delete colour profile:", cause);
      setError(
        "Could not reassign linked connections. The profile was not deleted."
      );
      finishDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section
      className="grid gap-3"
      data-testid="connection-profiles-settings"
    >
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Connections
        </div>
        <h3 className="m-0 mt-1 text-sm font-semibold text-text-primary">
          Colour profiles
        </h3>
        <p className="m-0 mt-1 text-sm leading-5 text-text-secondary">
          Profiles identify saved connections throughout the workbench. Built-in
          profiles cannot be changed.
        </p>
      </div>

      {visibleProfiles.length > 0 ? (
        <div className="grid gap-1.5">
          {visibleProfiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-2 rounded border border-bg-tertiary bg-bg-input px-3 py-2"
            >
              <span
                className="min-w-24 rounded border px-2 py-1 text-sm font-medium"
                style={{
                  backgroundColor: profile.background,
                  borderColor: profile.foreground,
                  color: profile.foreground,
                }}
              >
                {profile.name}
              </span>
              <span className="min-w-0 flex-1 font-mono text-[11px] text-text-secondary">
                {profile.background} / {profile.foreground}
              </span>
              {!profile.builtIn && (
                <>
                  <button
                    type="button"
                    onClick={(event) =>
                      openEditor(
                        { ...profile, builtIn: false },
                        event.currentTarget
                      )
                    }
                    className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-hover"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      deleteTriggerRef.current = event.currentTarget;
                      setDeleteCandidate({ ...profile, builtIn: false });
                      setError(null);
                    }}
                    className="rounded px-2 py-1 text-xs text-error hover:bg-error/10 focus:outline-none focus:ring-1 focus:ring-accent-hover"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-text-secondary">
          No colour profiles match your search.
        </p>
      )}

      {draft ? (
        <div className="grid gap-2 rounded border border-bg-tertiary bg-bg-secondary p-3">
          <div className="text-xs font-semibold text-text-primary">
            {profiles.some((profile) => profile.id === draft.id)
              ? "Edit profile"
              : "New profile"}
          </div>
          <label className="grid gap-1 text-xs text-text-secondary">
            Name
            <input
              ref={nameInputRef}
              autoFocus
              value={draft.name}
              aria-invalid={invalidField === "name" || undefined}
              aria-describedby={invalidField === "name" ? errorId : undefined}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              className="rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 text-sm text-text-primary focus:border-accent-hover focus:outline-none focus:ring-1 focus:ring-accent-hover"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-text-secondary">
              Background
              <input
                ref={backgroundInputRef}
                value={draft.background}
                aria-invalid={
                  invalidField === "background" ||
                  invalidField === "colours" ||
                  undefined
                }
                aria-describedby={
                  invalidField === "background" || invalidField === "colours"
                    ? errorId
                    : undefined
                }
                onChange={(event) =>
                  setDraft({ ...draft, background: event.target.value })
                }
                className="rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 font-mono text-sm text-text-primary focus:border-accent-hover focus:outline-none focus:ring-1 focus:ring-accent-hover"
              />
            </label>
            <label className="grid gap-1 text-xs text-text-secondary">
              Foreground
              <input
                ref={foregroundInputRef}
                value={draft.foreground}
                aria-invalid={
                  invalidField === "foreground" ||
                  invalidField === "colours" ||
                  undefined
                }
                aria-describedby={
                  invalidField === "foreground" || invalidField === "colours"
                    ? errorId
                    : undefined
                }
                onChange={(event) =>
                  setDraft({ ...draft, foreground: event.target.value })
                }
                className="rounded border border-bg-tertiary bg-bg-input px-2 py-1.5 font-mono text-sm text-text-primary focus:border-accent-hover focus:outline-none focus:ring-1 focus:ring-accent-hover"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEditor}
              className="rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-xs text-text-primary hover:bg-bg-tertiary focus:outline-none focus:ring-1 focus:ring-accent-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveDraft}
              className="rounded bg-accent px-3 py-1.5 text-xs text-accent-text hover:bg-accent-hover focus:outline-none focus:ring-1 focus:ring-accent-hover"
            >
              Save Profile
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={addButtonRef}
          type="button"
          onClick={(event) => openEditor(emptyDraft(), event.currentTarget)}
          className="justify-self-start rounded border border-dashed border-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:border-accent-hover hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-hover"
        >
          + Add Profile
        </button>
      )}

      {error && (
        <p id={errorId} className="m-0 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={!!deleteCandidate}
        title="Delete colour profile"
        message={`Reassign ${affectedConnections.length} linked connection${
          affectedConnections.length === 1 ? "" : "s"
        } to Red, then delete "${deleteCandidate?.name ?? ""}"?`}
        confirmLabel={deleting ? "Deleting..." : "Delete Profile"}
        danger
        busy={deleting}
        onConfirm={() => void deleteProfile()}
        onCancel={() => {
          if (!deleting) finishDelete();
        }}
      />
    </section>
  );
}
