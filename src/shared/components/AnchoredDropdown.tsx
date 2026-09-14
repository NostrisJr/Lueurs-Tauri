/**
 * AnchoredDropdown — dropdown positionné en fixed sous son ancre (desktop),
 * ou BottomSheet clavier-aware (mobile).
 */
import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "../../mobile/components/BottomSheet/BottomSheet";
import { isMobile } from "../lib/platform";

interface AnchoredDropdownProps {
  anchorRef: { current: HTMLElement | null };
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /**
   * Z-index de la popover — défaut pensé pour le contexte frontmatter (sous le
   * NoteHeader sticky, cf. plus bas). Un appelant qui rend cette popover à
   * l'intérieur d'un AUTRE calque déjà empilé (ex: InlineFormulaPopup, z-50)
   * doit passer un z-index supérieur à ce calque, sous peine que la popover
   * s'affiche (et surtout : reçoive les clics) DERRIÈRE lui.
   */
  zIndex?: number;
}

const DEFAULT_Z_INDEX = 15;

export function AnchoredDropdown({
  anchorRef,
  onClose,
  children,
  className = "",
  zIndex = DEFAULT_Z_INDEX,
}: AnchoredDropdownProps) {
  if (isMobile) {
    // `className` (desktop) porte souvent des classes de largeur/positionnement
    // qui n'ont pas de sens dans une sheet pleine largeur (ex: "w-48 p-3") —
    // on ne le reprend donc pas tel quel, juste un padding horizontal par
    // défaut : sans lui, TOUT contenu routé ici (rename, couleur, réglages
    // Nombre/Bouton, sélecteurs note/espace/dossier...) se retrouvait collé
    // aux bords de la sheet, BottomSheet ne posant elle-même aucun padding
    // horizontal sur son contenu.
    return (
      <BottomSheet onClose={onClose}>
        <div className="px-4 pb-4">{children}</div>
      </BottomSheet>
    );
  }
  return (
    <DesktopDropdown
      anchorRef={anchorRef}
      onClose={onClose}
      className={className}
      zIndex={zIndex}
    >
      {children}
    </DesktopDropdown>
  );
}

// ── Dropdown desktop ───────────────────────────────────────────────────────

function DesktopDropdown({
  anchorRef,
  onClose,
  children,
  className,
  zIndex = DEFAULT_Z_INDEX,
}: AnchoredDropdownProps) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const DROPDOWN_HEIGHT = 240;

  // Recalculée au scroll (capture : un ancêtre scrollable ne bubble pas son
  // scroll) et au resize — sinon la popover, en position fixed, reste figée
  // à l'écran pendant que son ancre défile sous elle.
  useEffect(() => {
    function updatePos() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT;
      setOpenUpward(up);
      setPos({
        top: up ? rect.top : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !anchorRef.current?.contains(target) &&
        // Un AnchoredDropdown imbriqué (ex: sélecteur ref()/self[ ouvert depuis
        // un NumberExprField à l'intérieur de ce dropdown) porte aussi ce
        // marqueur mais atterrit dans un portail séparé, donc hors de
        // containerRef — sans cette exclusion, un clic dedans serait vu comme
        // "extérieur" et fermerait prématurément CE dropdown-ci.
        !target.closest?.("[data-anchored-dropdown]")
      )
        onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  if (!pos) return null;

  // Portail vers document.body : sous WebKit (webview Tauri), un ancêtre
  // `overflow: hidden` (ex: le panneau de réglages animé en hauteur du
  // frontmatter) peut rogner un descendant `position: fixed` alors que ça ne
  // devrait pas arriver sans containing block (transform/filter) — bug connu
  // de ce moteur. Rendre la popover directement sous <body> lui évite tout
  // ancêtre qui pourrait la clipper ou désynchroniser sa zone cliquable.
  return createPortal(
    <div
      ref={containerRef}
      // Marqueur générique : permet aux popups englobants (ex: InlineFormulaPopup,
      // useExpandPanel) de reconnaître qu'un clic/focus part réellement d'ICI —
      // ce portail atterrit sous <body>, donc hors de leur sous-arbre DOM réel
      // (containment / bubbling natif cassés par le portail, cf. mémoire
      // contextmenu-selection pour un piège apparenté).
      data-anchored-dropdown=""
      style={{
        position: "fixed",
        top: openUpward ? undefined : pos.top,
        bottom: openUpward ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        minWidth: Math.max(pos.width, 220),
        // Par défaut (frontmatter) : sous le NoteHeader sticky (z-20), pour
        // que la popover disparaisse avec son ancre quand celle-ci défile
        // sous le header, plutôt que de rester flottante par-dessus. Un
        // appelant dans un calque déjà au-dessus (ex: InlineFormulaPopup,
        // z-50) surclasse via `zIndex` — cf. AnchoredDropdownProps.
        zIndex,
      }}
      className={clsx(
        "border rounded-lg shadow-lg overflow-hidden whitespace-normal",
        "bg-surface border-line-2",
        className
      )}
    >
      {children}
    </div>,
    document.body
  );
}
