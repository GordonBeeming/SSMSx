import { useEffect, useId, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      window.setTimeout(() => cancelButtonRef.current?.focus(), 0);
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="fixed left-1/2 top-1/2 m-0 w-[380px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-tertiary bg-bg-primary p-5 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4">
        <h3 id={titleId} className="m-0 text-sm font-semibold text-text-primary">
          {title}
        </h3>
        <p id={messageId} className="m-0 text-sm text-text-secondary">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded border border-bg-tertiary bg-bg-secondary px-4 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded px-4 py-1.5 text-sm text-accent-text focus:outline-none focus:ring-1 focus:ring-accent-hover disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "bg-error hover:bg-error/80"
                : "bg-accent hover:bg-accent-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
