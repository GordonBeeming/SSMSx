import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;

    const margin = 8;
    const rect = menu.getBoundingClientRect();
    const nextPosition = {
      x: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      y: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    };
    setPosition((current) => {
      if (current.x === nextPosition.x && current.y === nextPosition.y) {
        return current;
      }
      return nextPosition;
    });
  }, [x, y]);

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
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div
            key={`sep-${i}`}
            className="mx-2 my-1 border-t border-bg-tertiary"
          />
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
