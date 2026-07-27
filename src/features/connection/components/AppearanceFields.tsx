import { BUILT_IN_COLOR_PROFILES } from "../../../shared/connectionAppearance";
import { ColorProfileCombobox } from "../../../shared/components/ColorProfileCombobox";
import { useSettingsStore } from "../../settings";
import { useConnectionStore } from "../store/connectionStore";

/** Shared by both connection editors so alias and profile never diverge by tab. */
export function AppearanceFields() {
  const draft = useConnectionStore((state) => state.appearanceDraft);
  const setAppearanceDraft = useConnectionStore((state) => state.setAppearanceDraft);
  const customProfiles = useSettingsStore((state) => state.settings.connections.colorProfiles);
  const profiles = [...BUILT_IN_COLOR_PROFILES, ...customProfiles];
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label
          className="mb-1 block text-xs text-text-secondary"
          htmlFor="connection-alias"
        >
          Alias (optional)
        </label>
        <input
          id="connection-alias"
          type="text"
          value={draft.name}
          onChange={(event) =>
            setAppearanceDraft({ name: event.target.value })
          }
          placeholder="Production"
          className="w-full rounded border border-bg-tertiary bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none focus:ring-1 focus:ring-accent-hover"
        />
      </div>
      <ColorProfileCombobox
        profiles={profiles}
        value={draft.colorProfileId}
        onChange={(colorProfileId) =>
          setAppearanceDraft({ colorProfileId })
        }
      />
    </div>
  );
}
