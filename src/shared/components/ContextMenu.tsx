import { useEffect, useRef } from "react";

export type ContextMenuItem =
  | { type: "action"; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { type: "submenu"; label: string; items: ContextMenuItem[]; disabled?: boolean }
  | { type: "separator" };

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded border border-bg-tertiary bg-bg-secondary shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div
            key={`sep-${i}`}
            className="mx-2 my-1 border-t border-bg-tertiary"
          />
        ) : item.type === "submenu" ? (
          <div key={item.label} className="group/submenu relative">
            <button
              type="button"
              disabled={item.disabled}
              className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-sm text-text-primary hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-50"
            >
              <span>{item.label}</span>
              <span className="text-text-secondary">›</span>
            </button>
            {!item.disabled && (
              <div className="absolute left-full top-0 hidden min-w-[140px] rounded border border-bg-tertiary bg-bg-secondary shadow-lg group-hover/submenu:block">
                {item.items.map((child, childIndex) =>
                  child.type === "separator" ? (
                    <div
                      key={`child-sep-${childIndex}`}
                      className="mx-2 my-1 border-t border-bg-tertiary"
                    />
                  ) : child.type === "submenu" ? null : (
                    <button
                      type="button"
                      key={child.label}
                      disabled={child.disabled}
                      className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-bg-tertiary ${
                        child.danger
                          ? "text-error"
                          : child.disabled
                            ? "cursor-not-allowed text-text-secondary opacity-50"
                            : "text-text-primary"
                      }`}
                      onClick={() => {
                        if (!child.disabled) {
                          child.onClick();
                          onClose();
                        }
                      }}
                    >
                      {child.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            key={item.label}
            disabled={item.disabled}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-bg-tertiary ${
              item.danger
                ? "text-error"
                : item.disabled
                  ? "cursor-not-allowed text-text-secondary opacity-50"
                  : "text-text-primary"
            }`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
