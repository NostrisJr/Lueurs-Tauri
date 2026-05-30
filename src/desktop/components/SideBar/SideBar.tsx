import { clsx } from "clsx";
import { useAtom } from "jotai";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSidebarLeft } from "../../../shared/components/PlatformIcon";
import { sidebarCollapsedAtom } from "../../../shared/lib/atoms";
import { SideBarResizable } from "./SideBarResizable";

function SideBar() {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const [width, setWidth] = useState(240);
  const [resizing, setResizing] = useState(false);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    setResizing(true);
    e.preventDefault();

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX - 8, 230), 480);
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      setResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div className="relative z-30 flex py-2 pl-2 h-full bg-white">
      {/* Bouton toggle unique, porté dans document.body pour échapper au
          stacking context z-10 de la sidebar (sinon recouvert par la TitleBar
          z-40). Glisse du bord droit de la sidebar (ouverte) vers la gauche
          (repliée), en synchro avec l'animation de largeur de l'aside.
          Étendu : bord droit du bouton = 8 (p conteneur) + 1 (bordure) + 8
          (p aside) + width - 12 (marge) ; largeur bouton ~36 → left = width - 31. */}
      {createPortal(
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Afficher la sidebar" : "Réduire la sidebar"}
          title={collapsed ? "Afficher" : "Réduire"}
          className="fixed z-50 flex justify-center items-center text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 rounded-full"
          style={{
            top: 16,
            left: collapsed ? 88 : width - 20,
            transition: resizing ? "none" : "left 220ms ease, top 220ms ease",
          }}
        >
          <IconSidebarLeft className="size-5" aria-hidden="true" />
        </button>,
        document.body
      )}

      <aside
        className={clsx(
          "relative shrink-0 flex flex-col rounded-[1.2rem] box-content bg-slate-50 border border-white overflow-hidden shadow-2xl",
          collapsed ? "p-0" : "p-2"
        )}
        style={{
          width: collapsed ? 0 : width,
          transition: resizing
            ? "none"
            : "width 220ms ease, padding 220ms ease",
        }}
      >
        <SideBarResizable />
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50 rounded-full my-3"
        />
      </aside>
    </div>
  );
}

export { SideBar };
