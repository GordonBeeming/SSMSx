import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { settingsSchema } from "../settingsSchema";
import { useSettingsStore } from "../store/settingsStore";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open: isOpen, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState("");
  const settings = useSettingsStore((state) => state.settings);
  const setGroupTablesBySchema = useSettingsStore(
    (state) => state.setGroupTablesBySchema
  );
  const setPersistQueryTabs = useSettingsStore(
    (state) => state.setPersistQueryTabs
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const filteredSettings = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return settingsSchema;

    return settingsSchema.filter((setting) =>
      [
        setting.category,
        setting.title,
        setting.description,
        ...setting.keywords,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [searchText]);

  const categories = useMemo(
    () => Array.from(new Set(settingsSchema.map((setting) => setting.category))),
    []
  );

  const isSettingEnabled = (settingId: string): boolean => {
    switch (settingId) {
      case "explorer.groupTablesBySchema":
        return settings.explorer.groupTablesBySchema;
      case "workspace.persistQueryTabs":
        return settings.workspace.persistQueryTabs;
      default:
        return false;
    }
  };

  const updateSetting = (settingId: string, value: boolean): void => {
    switch (settingId) {
      case "explorer.groupTablesBySchema":
        setGroupTablesBySchema(value);
        break;
      case "workspace.persistQueryTabs":
        setPersistQueryTabs(value);
        break;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="fixed left-1/2 top-1/2 m-0 h-[560px] max-h-[86vh] w-[720px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-tertiary bg-bg-primary p-0 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <section className="flex h-full min-h-0 flex-col">
        <header className="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
          <h2 className="m-0 text-base font-semibold">Settings</h2>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-r border-bg-tertiary bg-bg-secondary p-3">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                ref={searchRef}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search settings..."
                className="w-full rounded border border-bg-tertiary bg-bg-input py-1.5 pl-7 pr-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-hover focus:outline-none"
              />
            </div>

            <nav className="mt-3 grid gap-1">
              {categories.map((category) => (
                <div
                  key={category}
                  className="rounded px-2 py-1.5 text-xs font-medium text-text-secondary first:bg-bg-tertiary first:text-text-primary"
                >
                  {category}
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-h-0 overflow-auto p-4">
            {filteredSettings.length === 0 ? (
              <p className="m-0 text-sm text-text-secondary">
                No settings match your search.
              </p>
            ) : (
              <div className="grid gap-4">
                {filteredSettings.map((setting) => (
                  <section key={setting.id} className="grid gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        {setting.category}
                      </div>
                      <h3 className="m-0 mt-1 text-sm font-semibold text-text-primary">
                        {setting.title}
                      </h3>
                      <p className="m-0 mt-1 text-sm leading-5 text-text-secondary">
                        {setting.description}
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 rounded border border-bg-tertiary bg-bg-input px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary">
                      <input
                        type="checkbox"
                        checked={isSettingEnabled(setting.id)}
                        onChange={(event) =>
                          updateSetting(setting.id, event.target.checked)
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      <span>Enabled</span>
                    </label>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </dialog>
  );
}
