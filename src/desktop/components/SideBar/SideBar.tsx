import { useAtom, useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSidebarLeft } from "../../../shared/components/PlatformIcon";
import {
  activeSpaceAtom,
  sidebarCollapsedAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { SideBarResizable } from "./SideBarResizable";

function SideBar() {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const [width, setWidth] = useState(240);
  const [resizing, setResizing] = useState(false);
  const isResizing = useRef(false);

  const activeSpace = useAtomValue(activeSpaceAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const accentColor = activeSpace
    ? vaultConfig?.spaces.find((s) => s.name === activeSpace)?.color
    : undefined;

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

  // Largeur totale de l'aside (box-content + padding:8 = +16px, pas de border).
  // Le div de bordure gradient doit dépasser de 1px de chaque côté → +18px au total.
  const borderDivWidth = collapsed ? 0 : width + 18;

  return (
    // Les custom properties CSS ici propagent aux enfants grâce à @property inherits:true.
    // sidebar-gradient-border et sidebar-infuse-overlay lisent ces variables et les animent.
    <div
      className="relative z-30 flex py-2 pl-2 h-full bg-white"
      style={{
        "--sidebar-accent": accentColor ?? "white",
        "--sidebar-infuse": accentColor ? `${accentColor}20` : "transparent",
      } as React.CSSProperties}
    >
      {/* Bouton toggle unique, porté dans document.body pour échapper au
          stacking context z-10 de la sidebar (sinon recouvert par la TitleBar
          z-40). Glisse du bord droit de la sidebar (ouverte) vers la gauche
          (repliée), en synchro avec l'animation de largeur de l'aside. */}
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

      {/* Gradient border : div absolu, 1px en dehors de l'aside sur tous les côtés.
          Peint avant l'aside (DOM order) → reste derrière malgré z-index:auto.
          width:0 quand collapsed → aucun strip visible. */}
      <div
        className="sidebar-gradient-border"
        style={{
          top: 7,
          bottom: 7,
          left: 7,
          width: borderDivWidth,
          transition: resizing ? "none" : "width 220ms ease",
        }}
      />

      {/* Aside restauré à sa structure originale (box-content, même positionnement).
          Le bouton toggle et les coordonnées sont inchangés. */}
      <aside
        className="relative shrink-0 flex flex-col rounded-[1.2rem] box-content bg-slate-50 overflow-hidden shadow-2xl"
        style={{
          width: collapsed ? 0 : width,
          padding: collapsed ? 0 : 8,
          transition: resizing
            ? "none"
            : "width 220ms ease, padding 220ms ease",
        }}
      >
        {/* Infusion : gradient intérieur animé via --sidebar-infuse */}
        <div
          className="sidebar-infuse-overlay absolute inset-0 pointer-events-none"
          style={{ borderRadius: "1.1rem" }}
        />

        {/* SideBarResizable est position:relative → peint au-dessus de l'overlay */}
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
