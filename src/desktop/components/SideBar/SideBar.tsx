import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FloatingComponent } from "../../../mobile/components/Floating/FloatingComponent";
import { IconSidebarLeft } from "../../../shared/components/PlatformIcon";
import {
  activeSpaceAtom,
  sidebarCollapsedAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { SideBarResizable } from "./SideBarResizable";
import { GLASS_HEIGHT, GLASS_ICON_BUTTON } from "./glassStyles";

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
      const newWidth = Math.min(Math.max(e.clientX - 16, 230), 480);
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
    // La custom property CSS propage aux enfants grâce à @property inherits:true.
    // sidebar-infuse-overlay la lit et l'anime.
    <div
      className="relative z-30 flex h-full"
      style={
        {
          "--sidebar-infuse": accentColor ? `${accentColor}35` : "transparent",
        } as React.CSSProperties
      }
    >
      {/* Bouton toggle unique, porté dans document.body pour échapper au
          stacking context z-10 de la sidebar (sinon recouvert par la TitleBar
          z-40). Glisse du bord droit de la sidebar (ouverte) vers la gauche
          (repliée), en synchro avec l'animation de largeur de l'aside. */}
      {createPortal(
        <div
          className="fixed z-50"
          style={{
            top: 8,
            left: collapsed ? 88 : width - 36,
            transition: resizing ? "none" : "left 220ms ease, top 220ms ease",
          }}
        >
          <FloatingComponent height={GLASS_HEIGHT}>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={
                collapsed ? "Afficher la sidebar" : "Réduire la sidebar"
              }
              title={collapsed ? "Afficher" : "Réduire"}
              className={GLASS_ICON_BUTTON}
            >
              <IconSidebarLeft className="size-5" aria-hidden="true" />
            </button>
          </FloatingComponent>
        </div>,
        document.body
      )}

      {/* Pleine hauteur, collée aux bords (macOS 27) : fond translucide sur la vibrancy,
          séparée du contenu par un simple filet. box-content : width = zone utile. */}
      <aside
        className={clsx(
          "relative shrink-0 flex flex-col box-content overflow-hidden",
          "bg-sidebar",
          !collapsed && "border-r border-line"
        )}
        style={{
          width: collapsed ? 0 : width,
          padding: collapsed ? 0 : "8px 8px 16px",
          transition: resizing
            ? "none"
            : "width 220ms ease, padding 220ms ease",
        }}
      >
        {/* Infusion : voile d'accent depuis la bordure droite, animé via --sidebar-infuse */}
        <div className="sidebar-infuse-overlay absolute inset-0 pointer-events-none" />

        {/* SideBarResizable est position:relative → peint au-dessus de l'overlay */}
        <SideBarResizable />

        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50"
        />
      </aside>
    </div>
  );
}

export { SideBar };
