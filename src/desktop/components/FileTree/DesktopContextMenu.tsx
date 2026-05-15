import { sfArrowUpForward, sfPencil, sfTrash } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

type SFIconProp = ComponentProps<typeof SFIcon>["icon"];

export interface ContextMenuAction {
  label: string;
  icon: SFIconProp;
  iconColor: string;
  labelColor?: string;
  separator?: boolean;
  onPress: () => void;
}

interface Props {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function DesktopContextMenu({ x, y, actions, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Ajuste la position pour ne pas sortir de l'écran
  const style: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 9999,
    minWidth: 180,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    overflow: "hidden",
  };

  return createPortal(
    <div ref={menuRef} style={style}>
      {actions.map((action, i) => (
        <div key={action.label}>
          {action.separator && i > 0 && <div className="h-px bg-gray-100" />}
          <button
            type="button"
            onClick={() => {
              action.onPress();
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 transition-colors text-left ${action.labelColor ?? "text-gray-900"}`}
          >
            <SFIcon
              icon={action.icon}
              className={`size-4 ${action.iconColor} shrink-0`}
            />
            {action.label}
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

export { sfPencil, sfTrash, sfArrowUpForward };
export type { SFIconProp };
