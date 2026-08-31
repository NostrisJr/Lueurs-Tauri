import { useDrag } from "@use-gesture/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Squircle } from "../../../shared/components/Squircle";
import { hapticImpact } from "../../lib/haptics";
import type { RowMenuAction, RowMenuConfig } from "./types";

const ENTER_MS = 280;
const EXIT_MS = 180;
// Spring léger façon iOS (léger dépassement) à l'ouverture, décélération à la fermeture.
const ENTER_EASING = "cubic-bezier(0.32, 1.4, 0.5, 1)";
const EXIT_EASING = "cubic-bezier(0.4, 0, 1, 1)";

// Marges de sécurité pour le groupe aperçu+menu (barre d'état / home indicator).
const TOP_MARGIN = 64;
const BOTTOM_MARGIN = 44;
const GAP = 10;
const MENU_MAX_WIDTH = 250;
// Au-delà, le doigt reposé sur l'aperçu passe du tap au déplacement.
const DRAG_START_PX = 8;
// Repli de l'aperçu en vignette quand il devient le ghost de déplacement.
const DRAG_MORPH_MS = 200;
const DRAG_SCALE = 0.9;
const DRAG_CARD_MAX_H = 76;
// Décalage vertical du ghost, en % de la hauteur de la carte : elle se pose
// juste au-dessus du doigt, avec un léger recouvrement, pour que la rangée
// visée reste lisible en dessous.
const DRAG_OFFSET = "-85%";

export type MenuPhase = "held" | "open" | "dragging";

interface Props {
  /** Rectangle de la rangée source : origine de l'animation et position du groupe. */
  rect: DOMRect;
  config: RowMenuConfig;
  phase: MenuPhase;
  /** Position du doigt en phase "dragging" — l'aperçu devient le ghost. */
  dragPoint: { x: number; y: number } | null;
  onDismiss: () => void;
  /** Tap sur l'aperçu : ouvrir la note / entrer dans le dossier. */
  onActivate: () => void;
  /** Sans ça, l'aperçu ne réagit qu'au tap (listes sans déplacement possible). */
  dragEnabled?: boolean;
  /** Reprise du geste sur l'aperçu après relâchement (menu ouvert). */
  onDragBegin: (x: number, y: number) => void;
  onDragUpdate: (x: number, y: number) => void;
  onDragFinish: (x: number, y: number) => void;
}

function ActionButton({
  action,
  onRun,
}: {
  action: RowMenuAction;
  onRun: (action: RowMenuAction) => void;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 active:bg-black/5 transition-colors ${
        action.destructive ? "text-red-500" : "text-gray-900"
      }`}
    >
      <Icon className="size-5" />
      <span className="text-xs font-medium">{action.label}</span>
    </button>
  );
}

function ActionRow({
  action,
  onRun,
}: {
  action: RowMenuAction;
  onRun: (action: RowMenuAction) => void;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-black/5 transition-colors ${
        action.destructive ? "text-red-500" : "text-gray-900"
      }`}
    >
      <span className="flex-1 min-w-0 truncate text-base">{action.label}</span>
      <Icon className="size-4.5 shrink-0" />
    </button>
  );
}

/**
 * Menu contextuel iOS : l'aperçu de la rangée se soulève au-dessus d'un fond
 * flouté, le menu d'actions se déplie en dessous.
 *
 * Trois phases, pilotées par le parent (MobileRowGestures) qui possède le geste :
 *   - "held"     : doigt encore posé sur la rangée → overlay non interactif
 *   - "open"     : doigt relevé → menu et aperçu interactifs
 *   - "dragging" : l'aperçu devient le ghost de déplacement, tout le reste s'efface
 */
export function RowContextMenu({
  rect,
  config,
  phase,
  dragPoint,
  onDismiss,
  onActivate,
  dragEnabled = false,
  onDragBegin,
  onDragUpdate,
  onDragFinish,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    top: number;
    maxCardH: number;
  } | null>(null);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const exitTimerRef = useRef<number | undefined>(undefined);

  const primary = config.primary ?? [];
  const items = config.items ?? [];

  // Placement : le menu se déplie toujours SOUS l'aperçu (comme iOS quand la
  // place le permet). Le groupe est ancré sur la rangée d'origine puis remonté
  // juste ce qu'il faut pour tenir à l'écran ; si même ainsi il déborde,
  // l'aperçu est écrêté (maxCardH) plutôt que le menu, jamais l'inverse.
  useLayoutEffect(() => {
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const vh = window.innerHeight;
    const maxCardH = Math.max(
      64,
      vh - TOP_MARGIN - BOTTOM_MARGIN - GAP - menuH
    );
    const cardH = Math.min(
      cardRef.current?.offsetHeight ?? rect.height,
      maxCardH
    );
    const groupH = cardH + GAP + menuH;
    const top = Math.min(
      Math.max(rect.top, TOP_MARGIN),
      Math.max(TOP_MARGIN, vh - BOTTOM_MARGIN - groupH)
    );
    setLayout({ top, maxCardH });
  }, [rect]);

  // Deux frames distinctes pour que la transition ait deux états à interpoler.
  useEffect(() => {
    if (!layout) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  useEffect(
    () => () => {
      if (exitTimerRef.current !== undefined)
        window.clearTimeout(exitTimerRef.current);
    },
    []
  );

  function requestClose() {
    if (closing) return;
    setClosing(true);
    exitTimerRef.current = window.setTimeout(onDismiss, EXIT_MS);
  }

  // L'action s'exécute une fois le menu effacé : sinon une action qui ouvre une
  // bottom sheet (Renommer, Espaces) la fait apparaître par-dessus le menu
  // encore en train de disparaître.
  function runAction(action: RowMenuAction) {
    hapticImpact("light");
    requestClose();
    window.setTimeout(() => action.onPress(), EXIT_MS);
  }

  // Geste sur l'aperçu une fois le doigt relevé : tap → ouvrir, mouvement → déplacer.
  const draggingRef = useRef(false);
  const bindPreview = useDrag(
    ({ first, last, tap, xy: [x, y], movement: [mx, my], event }) => {
      if (phase !== "open" && !draggingRef.current) return;
      if (first) draggingRef.current = false;

      if (tap && last) {
        onActivate();
        return;
      }

      if (!draggingRef.current) {
        if (!dragEnabled || Math.hypot(mx, my) < DRAG_START_PX) return;
        draggingRef.current = true;
        onDragBegin(x, y);
      }

      event?.preventDefault?.();
      if (last) {
        draggingRef.current = false;
        onDragFinish(x, y);
      } else {
        onDragUpdate(x, y);
      }
    },
    { filterTaps: true }
  );

  const isDragging = phase === "dragging";
  const visible = entered && !closing && !isDragging;

  // Un seul arbre pour les trois phases : passer par un rendu alternatif en
  // phase "dragging" recréerait le nœud de l'aperçu en plein geste, et le
  // pointer capture du doigt serait perdu au moment même où le drag démarre.
  const originX = rect.width / 2;
  const originY = layout ? rect.top - layout.top + rect.height / 2 : 0;

  const groupStyle: React.CSSProperties =
    isDragging && dragPoint
      ? {
          position: "fixed",
          left: dragPoint.x,
          top: dragPoint.y,
          width: rect.width,
          // La position suit le doigt sans transition (sinon l'aperçu traîne
          // derrière) ; seule l'échelle est animée, au moment du basculement.
          // Les % de `translate` portent sur la hauteur de ce groupe : c'est
          // pour ça que le menu doit sortir du flux (cf. plus bas), sinon
          // l'aperçu se retrouve décalé de la hauteur du menu invisible.
          transform: `translate(-50%, ${DRAG_OFFSET}) scale(${DRAG_SCALE})`,
          transformOrigin: "center",
          transition: `transform ${DRAG_MORPH_MS}ms ${ENTER_EASING}`,
          opacity: 0.96,
          pointerEvents: "none",
        }
      : {
          position: "fixed",
          left: rect.left,
          top: layout?.top ?? rect.top,
          width: rect.width,
          transformOrigin: `${originX}px ${originY}px`,
          transform: visible ? "scale(1)" : "scale(0.9)",
          opacity: visible ? 1 : 0,
          transition: closing
            ? `transform ${EXIT_MS}ms ${EXIT_EASING}, opacity ${EXIT_MS}ms ${EXIT_EASING}`
            : `transform ${ENTER_MS}ms ${ENTER_EASING}, opacity 160ms ease-out`,
          // Sans layout mesuré (première frame), le groupe est invisible : pas de flash.
          visibility: layout ? "visible" : "hidden",
          // Le groupe est plus large que son contenu visible (aperçu pleine
          // largeur, mais menu centré et plus étroit) : sans ça, la marge
          // autour du menu et l'interligne aperçu/menu interceptent le tap au
          // lieu de le laisser passer jusqu'au fond flouté. Carte et menu
          // réactivent chacun leurs propres pointerEvents ci-dessous.
          pointerEvents: "none",
        };

  const overlay = (
    <div
      className="fixed inset-0 z-70"
      style={{
        // En phase "dragging" l'overlay ne doit plus rien intercepter : les
        // dossiers cibles sont dessous (cf. détection par elementsFromPoint).
        pointerEvents: phase === "open" && !closing ? "auto" : "none",
        touchAction: "none",
      }}
    >
      {/* Fond flouté — tap pour fermer */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-md"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${visible ? ENTER_MS : EXIT_MS}ms ease-out`,
        }}
        onClick={requestClose}
      />

      <div style={groupStyle}>
        <div
          ref={cardRef}
          {...bindPreview()}
          style={{
            // Le geste de reprise appartient à cette carte : elle reste
            // hit-testable même quand la racine ne l'est plus (le doigt encore
            // posé sur la rangée en phase "held" est déjà capturé par elle).
            pointerEvents: phase === "held" ? "none" : "auto",
            touchAction: "none",
          }}
        >
          {/* L'écrêtage porte sur le Squircle lui-même, et non sur un parent :
              son clip-path est recalculé par ResizeObserver à la hauteur
              effective, donc les coins bas restent arrondis. Rogné de
              l'extérieur, il gardait le tracé de sa hauteur pleine et se
              retrouvait coupé net en bas. */}
          <Squircle
            radius={20}
            className="w-full bg-white overflow-hidden"
            style={{
              // L'aperçu se replie en vignette au démarrage du déplacement :
              // à pleine hauteur il masque les dossiers qu'on vise.
              maxHeight: isDragging ? DRAG_CARD_MAX_H : layout?.maxCardH,
              transition: `max-height ${DRAG_MORPH_MS}ms ${ENTER_EASING}`,
            }}
          >
            {config.preview}
          </Squircle>
        </div>

        <div
          ref={menuRef}
          style={{
            marginTop: GAP,
            width: Math.min(rect.width, MENU_MAX_WIDTH),
            marginInline: "auto",
            opacity: isDragging ? 0 : 1,
            transition: `opacity ${EXIT_MS}ms ease-out`,
            pointerEvents: isDragging ? "none" : "auto",
            // Sorti du flux pendant le déplacement : invisible ne suffit pas,
            // il continuerait à compter dans la hauteur du groupe et donc à
            // décaler le ghost vers le haut. Sans offsets, il reste à sa
            // position statique — le temps de finir son fondu.
            position: isDragging ? "absolute" : undefined,
          }}
        >
          <Squircle
            radius={14}
            className="w-full bg-white/90 backdrop-blur-2xl overflow-hidden"
          >
            {primary.length > 0 && (
              <div className="flex items-stretch divide-x divide-gray-200/70">
                {primary.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    onRun={runAction}
                  />
                ))}
              </div>
            )}
            {primary.length > 0 && items.length > 0 && (
              <div className="h-px bg-gray-200/70" />
            )}
            {items.length > 0 && (
              <div className="flex flex-col divide-y divide-gray-200/70">
                {items.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    onRun={runAction}
                  />
                ))}
              </div>
            )}
          </Squircle>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
