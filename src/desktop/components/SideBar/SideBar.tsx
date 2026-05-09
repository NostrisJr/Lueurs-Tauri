import { sfSidebarLeft } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtom } from "jotai";
import { sidebarCollapsedAtom } from "../../../shared/lib/Atoms";
import { useState, useRef, useCallback } from "react";
import { SideBarResizable } from "./SideBarResizable";
import { clsx } from "clsx";

function SideBar() {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const [width, setWidth] = useState(240);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX - 8, 230), 480);
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <>
      {/* Bouton re-open, visible uniquement quand collapsed */}
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Afficher la sidebar"
        title="Afficher la sidebar"
        className="fixed z-50 top-3 left-22 text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 rounded-full transition-[opacity,transform] duration-300"
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? "auto" : "none",
          transform: collapsed ? "translateX(0)" : "translateX(10px)",
        }}
      >
        <SFIcon icon={sfSidebarLeft} className="size-5" aria-hidden="true" />
      </button>

      <aside
        className={clsx(
          "relative shrink-0 flex flex-col rounded-[1.25rem] box-content bg-white/60 outline-16 outline-white -outline-offset-8 overflow-hidden",
          collapsed ? "p-0" : "p-2"
        )}
        style={{
          width: collapsed ? 0 : width,
          transition: "width 220ms ease, padding 220ms ease",
        }}
      >
        <SideBarResizable onToggle={() => setCollapsed(true)} />
        <div
          onMouseDown={startResize}
          className="absolute right-2 top-0 bottom-0 w-1 cursor-col-resize z-50 rounded-full my-3"
        />
      </aside>
    </>
  );
}

export { SideBar };
