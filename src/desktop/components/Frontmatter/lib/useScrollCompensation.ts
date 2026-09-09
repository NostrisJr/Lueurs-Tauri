import { useAtomValue } from "jotai";
import { type RefObject, useEffect, useRef } from "react";
import { noteScrollContainerAtom } from "../../../../shared/lib/atoms";
import { tailwindEaseOut } from "./cubicBezierEasing";
import { CLOSE_TRANSITION_MS } from "./useExpandPanel";

/**
 * Compense en scrollant le conteneur de la note (même ref que useCaretScroll,
 * cf. noteScrollContainerAtom) pour que tout ce qui suit `wrapperRef` dans la
 * page (ex. le champ valeur juste sous le switcher Texte/Nombre) reste
 * visuellement fixe à l'ouverture/fermeture du panneau, au lieu d'être
 * décalé — le contenu au-dessus défile à la place.
 *
 * `rendered` : le wrapper existe dans le DOM (peut encore être replié à 0px).
 * `contentHeight` : hauteur du panneau déjà mesurée par useAnimatedHeight —
 * réutilisée telle quelle plutôt que remesurée indépendamment ici.
 * `expanded` : déclenche réellement la transition CSS (height 0↔mesurée,
 * cf. useAnimatedHeight), dans les deux sens — cf. useExpandPanel.mounted.
 *
 * Row-gap et déclenchement sont volontairement séparés en deux effets : le
 * row-gap est lu dès que le wrapper apparaît (`rendered`), donc bien avant
 * que `expanded` ne démarre la transition — aucune lecture de layout
 * (getComputedStyle, synchrone) ne se produit plus au moment critique où
 * l'animation doit partir, ni à l'ouverture ni à la fermeture : les deux se
 * contentent de rejouer une valeur déjà en cache, symétriquement.
 */
export function useScrollCompensation(
  wrapperRef: RefObject<HTMLDivElement | null>,
  rendered: boolean,
  contentHeight: number,
  expanded: boolean
) {
  const container = useAtomValue(noteScrollContainerAtom);
  const rowGapRef = useRef(0);
  const wasExpandedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Row-gap (gap-y-1 du conteneur grid de la ligne) qui n'existe pas tant
  // qu'il n'y a qu'une seule ligne — sans lui, le champ atterrit quelques px
  // trop haut (sous-compensé) une fois le panneau ouvert.
  useEffect(() => {
    if (!rendered) return;
    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;
    const rowGap = Number.parseFloat(getComputedStyle(parent).rowGap);
    rowGapRef.current = Number.isNaN(rowGap) ? 0 : rowGap;
  }, [rendered, wrapperRef]);

  useEffect(() => {
    if (!container || contentHeight <= 0) return;

    function animateBy(delta: number) {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      const from = container?.scrollTop ?? 0;
      const t0 = performance.now();
      function step(now: number) {
        const t = Math.min((now - t0) / CLOSE_TRANSITION_MS, 1);
        const eased = tailwindEaseOut(t);
        if (container) container.scrollTop = from + delta * eased;
        rafIdRef.current = t < 1 ? requestAnimationFrame(step) : null;
      }
      rafIdRef.current = requestAnimationFrame(step);
    }

    const totalHeight = contentHeight + rowGapRef.current;
    if (expanded && !wasExpandedRef.current) {
      animateBy(totalHeight);
    } else if (!expanded && wasExpandedRef.current) {
      animateBy(-totalHeight);
    }
    wasExpandedRef.current = expanded;

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [expanded, container, contentHeight]);
}
