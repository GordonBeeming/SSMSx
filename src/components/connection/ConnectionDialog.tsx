import { useEffect, useRef } from "react";
import { useConnectionStore, type DialogTab } from "../../stores/connectionStore";
import { ConnectionList } from "./ConnectionList";
import { PropertiesTab } from "./PropertiesTab";
import { ConnectionStringTab } from "./ConnectionStringTab";
import { CustomTab } from "./CustomTab";

const TABS: { key: DialogTab; label: string }[] = [
  { key: "properties", label: "Properties" },
  { key: "connectionString", label: "Connection String" },
  { key: "custom", label: "Custom" },
];

export function ConnectionDialog() {
  const { dialogOpen, dialogTab, setDialogTab, closeDialog, error } =
    useConnectionStore();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (dialogOpen && !el.open) {
      el.showModal();
    } else if (!dialogOpen && el.open) {
      el.close();
    }
  }, [dialogOpen]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={closeDialog}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 w-[780px] max-w-[94vw] rounded-lg border border-bg-tertiary bg-bg-primary p-0 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <div className="flex h-[500px] max-h-[80vh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
          <h2 className="text-base font-semibold">Connect to Server</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={closeDialog}
            className="border-none bg-transparent p-1 text-lg text-text-secondary hover:text-text-primary"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left: Recent connections */}
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-bg-tertiary p-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
              Recent
            </h3>
            <ConnectionList />
          </div>

          {/* Right: Tabs + form */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Tab bar */}
            <div className="flex border-b border-bg-tertiary">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDialogTab(tab.key)}
                  className={`border-b-2 px-4 py-2 text-sm transition-colors ${
                    dialogTab === tab.key
                      ? "border-accent-hover text-text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex min-h-0 flex-1 flex-col p-4">
              {dialogTab === "properties" && <PropertiesTab />}
              {dialogTab === "connectionString" && <ConnectionStringTab />}
              {dialogTab === "custom" && <CustomTab />}
            </div>

            {/* Error bar */}
            {error && (
              <div className="border-t border-bg-tertiary bg-error/10 px-4 py-2 text-sm text-error">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
