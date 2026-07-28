import { useEffect, useId, useRef, useState } from "react";
import type { ColorProfile } from "../../features/settings/types";

interface ColorProfileComboboxProps {
  profiles: readonly ColorProfile[];
  value: string;
  onChange: (profileId: string) => void;
  label?: string;
}

const TYPEAHEAD_RESET_MS = 600;

export function ColorProfileCombobox({
  profiles,
  value,
  onChange,
  label = "Colour profile",
}: ColorProfileComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      profiles.findIndex((profile) => profile.id === value)
    )
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<number | null>(null);
  const controlId = useId();
  const labelId = useId();
  const listboxId = useId();
  const selected =
    profiles.find((profile) => profile.id === value) ?? profiles[0];

  useEffect(() => {
    setActiveIndex(
      Math.max(
        0,
        profiles.findIndex((profile) => profile.id === value)
      )
    );
  }, [profiles, value]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      if (typeaheadTimerRef.current !== null) {
        window.clearTimeout(typeaheadTimerRef.current);
      }
    };
  }, []);

  const choose = (index: number) => {
    const profile = profiles[index];
    if (profile) onChange(profile.id);
    setOpen(false);
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  };

  const moveToMatchingProfile = (character: string) => {
    if (typeaheadTimerRef.current !== null) {
      window.clearTimeout(typeaheadTimerRef.current);
    }
    typeaheadRef.current += character.toLowerCase();
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = "";
      typeaheadTimerRef.current = null;
    }, TYPEAHEAD_RESET_MS);

    const orderedIndexes = profiles.map(
      (_, offset) => (activeIndex + 1 + offset) % profiles.length
    );
    const match = orderedIndexes.find((index) =>
      profiles[index].name.toLowerCase().startsWith(typeaheadRef.current)
    );
    if (match !== undefined) {
      setOpen(true);
      setActiveIndex(match);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!profiles.length) return;

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        choose(activeIndex);
      } else {
        setOpen(true);
      }
      return;
    }

    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(profiles.length - 1, activeIndex + 1)
        : event.key === "ArrowUp"
          ? Math.max(0, activeIndex - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? profiles.length - 1
              : null;
    if (nextIndex !== null) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(nextIndex);
      return;
    }

    if (
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      moveToMatchingProfile(event.key);
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      data-testid="color-profile-combobox"
    >
      <label
        id={labelId}
        htmlFor={controlId}
        className="mb-1 block text-xs text-text-secondary"
      >
        {label}
      </label>
      <button
        ref={buttonRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open ? `${listboxId}-${activeIndex}` : undefined
        }
        disabled={!selected}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        className="flex w-full items-center justify-between rounded border border-bg-tertiary px-3 py-1.5 text-left text-sm focus:border-accent-hover focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        style={
          selected
            ? {
                backgroundColor: selected.background,
                color: selected.foreground,
              }
            : undefined
        }
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.name ?? "No profiles"}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded border border-bg-tertiary bg-bg-primary p-1 shadow-lg"
        >
          {profiles.map((profile, index) => (
            <div
              key={profile.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={profile.id === value}
              onMouseEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => {
                // Keep mouse focus on the combobox until click selection, while
                // leaving touch pointer movement alone so the list can scroll.
                if (event.pointerType === "mouse") event.preventDefault();
              }}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center rounded px-2 py-1.5 text-left text-xs outline-none ${
                index === activeIndex ? "ring-1 ring-accent-hover" : ""
              }`}
              style={{
                backgroundColor: profile.background,
                color: profile.foreground,
              }}
            >
              <span className="flex-1">{profile.name}</span>
              <span aria-hidden="true">
                {profile.id === value ? "✓" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
