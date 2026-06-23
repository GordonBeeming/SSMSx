import { useEffect, useRef } from "react";
import { useConnectionStore } from "../store/connectionStore";

export function ConnectionAuthProgressDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loading = useConnectionStore((state) => state.loading);
  const activeOperation = useConnectionStore((state) => state.activeOperation);
  const activeRequestId = useConnectionStore((state) => state.activeRequestId);
  const target = useConnectionStore((state) => state.activeOperationTarget);
  const cancelConnectionAttempt = useConnectionStore(
    (state) => state.cancelConnectionAttempt
  );

  const isOpen = loading && !!activeOperation && !!activeRequestId;
  const isEntra = target?.authType === "EntraMfa";
  const targetName = target?.name || target?.serverName || "selected server";
  const operationLabel =
    activeOperation === "test" ? "Testing connection" : "Connecting";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        void cancelConnectionAttempt();
      }}
      className="fixed left-1/2 top-1/2 m-0 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-tertiary bg-bg-primary p-0 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <section className="grid gap-3 p-4">
        <div>
          <h2 className="m-0 text-base font-semibold">
            {isEntra ? "Authentication in progress" : operationLabel}
          </h2>
          <p className="m-0 mt-1 text-sm leading-5 text-text-secondary">
            {isEntra
              ? "Complete the browser sign-in, or cancel and choose another target."
              : "Waiting for the server to respond."}
          </p>
        </div>

        <div className="rounded border border-bg-tertiary bg-bg-secondary px-3 py-2 text-xs">
          <div className="font-medium text-text-primary">{targetName}</div>
          {target?.database && (
            <div className="mt-0.5 text-text-secondary">{target.database}</div>
          )}
          {target?.username && (
            <div className="mt-0.5 text-text-secondary">{target.username}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              void cancelConnectionAttempt();
            }}
            className="rounded border border-bg-tertiary bg-bg-primary px-4 py-1.5 text-sm text-text-primary hover:bg-bg-secondary"
          >
            Cancel
          </button>
        </div>
      </section>
    </dialog>
  );
}
