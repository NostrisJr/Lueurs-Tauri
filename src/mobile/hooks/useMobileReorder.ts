import { useCallback, useEffect, useRef, useState } from "react";
import { startDragAutoscroll } from "../lib/dragAutoscroll";
import { hapticImpact, hapticSelection } from "../lib/haptics";

interface Snapshot {
  id: string;
  /** Position du haut de la ligne, relative au haut de la liste. */
  top: number;
  height: number;
}

interface Options {
  /** Ordre courant des lignes, de haut en bas. */
  ids: string[];
  /** Commit final : déplacer `activeId` à la place occupée par `overId`. */
  onReorder: (activeId: string, overId: string) => void;
}

export interface ReorderState {
  activeId: string | null;
  /** Ref à poser sur chaque ligne, pour la mesure au démarrage. */
  registerRow: (id: string, el: HTMLElement | null) => void;
  /** Ref à poser sur le conteneur direct des lignes. */
  listRef: (el: HTMLElement | null) => void;
  /** Props à étaler sur la poignée de la ligne `id`. */
  handleProps: (id: string) => React.HTMLAttributes<HTMLElement>;
  /** Style de transform/élévation à appliquer à la ligne `id`. */
  rowStyle: (id: string) => React.CSSProperties;
}

/**
 * Réordonnancement vertical d'une liste au doigt, sur le modèle du drag du file
 * tree (cf. MobileRowGestures) : le geste est entièrement pris en charge à la
 * main, le scroll natif ne peut jamais le voler, et la liste défile toute seule
 * quand le doigt atteint un bord.
 *
 * Points clés, tous nécessaires sur WKWebView :
 *
 *   • `touchAction: "none"` sur la poignée — touch-action se fige au
 *     `touchstart` pour toute la durée du toucher : laisser le scroll vertical
 *     permissif l'autoriserait à emporter le geste dès le premier mouvement, et
 *     aucun `preventDefault` ultérieur ne pourrait plus l'arrêter.
 *   • `stopPropagation` au `touchstart` — la poignée est dans les 30 px du bord
 *     gauche où `useMobileSwipeGesture` (posé sur toute l'app) arme son retour
 *     arrière : sans ça, glisser une ligne fait sortir la page des réglages.
 *   • `setPointerCapture` — le doigt quitte forcément la poignée dès le premier
 *     pixel parcouru ; sans capture, plus aucun `pointermove` ne nous parvient.
 */
export function useMobileReorder({ ids, onReorder }: Options): ReorderState {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Décalage vertical de la ligne saisie, en px, relatif à sa position d'origine.
  const [dragOffset, setDragOffset] = useState(0);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const listElRef = useRef<HTMLElement | null>(null);
  const rowElsRef = useRef(new Map<string, HTMLElement>());
  // Le handler de pointeur tourne plusieurs fois par frame : l'état du geste est
  // tenu par des refs, jamais lu depuis le state React (qui arriverait trop tard).
  const snapshotRef = useRef<Snapshot[]>([]);
  const fromIndexRef = useRef(0);
  // Écart entre le point de saisie et le haut de la ligne, pour que celle-ci
  // reste « accrochée » au doigt exactement là où il l'a prise.
  const grabOffsetRef = useRef(0);
  const overIndexRef = useRef<number | null>(null);
  const pointRef = useRef({ x: 0, y: 0 });
  const stopAutoscrollRef = useRef<(() => void) | null>(null);

  const idsRef = useRef(ids);
  idsRef.current = ids;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const registerRow = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowElsRef.current.set(id, el);
    else rowElsRef.current.delete(id);
  }, []);

  const listRef = useCallback((el: HTMLElement | null) => {
    listElRef.current = el;
  }, []);

  // Coordonnée du doigt ramenée dans le repère de la liste. `getBoundingClientRect`
  // est relu à chaque appel (et non mémorisé au démarrage) : c'est ce qui garde le
  // calcul juste pendant l'autoscroll, où la liste défile sous un doigt immobile.
  function toListY(clientY: number): number {
    const rect = listElRef.current?.getBoundingClientRect();
    return clientY - (rect?.top ?? 0);
  }

  // Index d'insertion sous le doigt : première ligne dont le milieu est passé.
  function computeOverIndex(listY: number): number {
    const snap = snapshotRef.current;
    for (let i = 0; i < snap.length; i++) {
      if (listY < snap[i].top + snap[i].height / 2) return i;
    }
    return snap.length - 1;
  }

  function updateFromPoint(x: number, y: number) {
    pointRef.current = { x, y };
    const listY = toListY(y);
    const from = fromIndexRef.current;
    const snap = snapshotRef.current;
    if (!snap[from]) return;
    // Borné aux extrémités de la liste : le conteneur (carte Squircle) est en
    // overflow-hidden, une ligne qui déborderait serait rognée en plein geste.
    const last = snap[snap.length - 1];
    const min = -snap[from].top;
    const max = last.top + last.height - (snap[from].top + snap[from].height);
    const raw = listY - grabOffsetRef.current - snap[from].top;
    setDragOffset(Math.max(min, Math.min(max, raw)));
    const next = computeOverIndex(listY);
    if (next !== overIndexRef.current) {
      overIndexRef.current = next;
      setOverIndex(next);
      hapticSelection();
    }
  }

  const endDrag = useCallback((commit: boolean) => {
    stopAutoscrollRef.current?.();
    stopAutoscrollRef.current = null;
    const from = fromIndexRef.current;
    const to = overIndexRef.current;
    const order = idsRef.current;
    if (commit && to !== null && to !== from && order[from] && order[to]) {
      hapticImpact("medium");
      onReorderRef.current(order[from], order[to]);
    }
    setActiveId(null);
    setDragOffset(0);
    setOverIndex(null);
    overIndexRef.current = null;
  }, []);

  useEffect(() => () => stopAutoscrollRef.current?.(), []);

  function handlePointerDown(id: string, e: React.PointerEvent) {
    const listEl = listElRef.current;
    if (!listEl) return;
    const from = idsRef.current.indexOf(id);
    if (from === -1) return;

    // Mesure de toutes les lignes en une passe, avant tout déplacement : les
    // positions ne bougent plus ensuite (seuls des transforms sont appliqués),
    // donc ce repère reste valable pour toute la durée du geste.
    const listTop = listEl.getBoundingClientRect().top;
    snapshotRef.current = idsRef.current.map((rowId) => {
      const rect = rowElsRef.current.get(rowId)?.getBoundingClientRect();
      return {
        id: rowId,
        top: (rect?.top ?? listTop) - listTop,
        height: rect?.height ?? 0,
      };
    });
    fromIndexRef.current = from;
    grabOffsetRef.current = e.clientY - listTop - snapshotRef.current[from].top;
    overIndexRef.current = from;
    pointRef.current = { x: e.clientX, y: e.clientY };

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    hapticImpact("medium");
    setActiveId(id);
    setOverIndex(from);
    setDragOffset(0);

    stopAutoscrollRef.current?.();
    stopAutoscrollRef.current = startDragAutoscroll({
      container: () =>
        listElRef.current?.closest<HTMLElement>(
          "[data-mobile-scroll-container]"
        ) ?? null,
      point: () => pointRef.current,
      onScroll: (x, y) => updateFromPoint(x, y),
    });
  }

  // Pas de mémoïsation : ces props sont un objet neuf à chaque appel de toute
  // façon, et tout leur état vit dans des refs.
  function handleProps(id: string): React.HTMLAttributes<HTMLElement> {
    return {
      onPointerDown: (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        handlePointerDown(id, e);
      },
      onPointerMove: (e) => {
        if (overIndexRef.current === null) return;
        e.preventDefault();
        updateFromPoint(e.clientX, e.clientY);
      },
      onPointerUp: () => endDrag(true),
      onPointerCancel: () => endDrag(false),
      // Filet de sécurité : si le nœud qui détient la capture disparaît d'un
      // re-render en plein geste, aucun pointerup n'arrivera jamais.
      onLostPointerCapture: () => endDrag(false),
      onTouchStart: (e) => e.stopPropagation(),
      style: { touchAction: "none", WebkitTouchCallout: "none" },
    };
  }

  const rowStyle = useCallback(
    (id: string): React.CSSProperties => {
      if (!activeId) return {};
      const snap = snapshotRef.current;
      const from = fromIndexRef.current;
      const to = overIndex ?? from;
      const index = snap.findIndex((s) => s.id === id);
      if (index === -1) return {};

      if (id === activeId) {
        return {
          transform: `translateY(${dragOffset}px)`,
          zIndex: 2,
          position: "relative",
          // Pas de `scale` : le conteneur est en overflow-hidden, l'élargissement
          // serait rogné à gauche et à droite. L'ombre seule suffit à soulever.
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          borderRadius: 12,
          // La ligne est soulevée hors de la carte : son séparateur inférieur
          // n'a plus de sens et flotterait sous une carte arrondie.
          borderBottomColor: "transparent",
          // Aucune transition : la ligne saisie doit coller au doigt au pixel près.
          transition: "none",
        };
      }

      // Les lignes survolées se décalent de la hauteur de la ligne saisie pour
      // ouvrir la place — c'est ce trou qui rend la cible de dépôt lisible.
      const gap = snap[from]?.height ?? 0;
      let shift = 0;
      if (from < to && index > from && index <= to) shift = -gap;
      else if (to < from && index >= to && index < from) shift = gap;

      return {
        transform: `translateY(${shift}px)`,
        transition: "transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      };
    },
    [activeId, dragOffset, overIndex]
  );

  return { activeId, registerRow, listRef, handleProps, rowStyle };
}
