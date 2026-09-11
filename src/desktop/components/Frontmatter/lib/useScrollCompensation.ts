import { useAtomValue } from "jotai";
import { type RefObject, useEffect, useRef } from "react";
import { noteContentRootAtom } from "../../../../shared/lib/atoms";
import { tailwindEaseOut } from "./cubicBezierEasing";
import { CLOSE_TRANSITION_MS } from "./useExpandPanel";

/**
 * Compense en translatant (CSS transform, pas scrollTop) la racine de contenu
 * de la note (cf. noteContentRootAtom) pour que tout ce qui suit `wrapperRef`
 * dans la page (ex. le champ valeur juste sous le switcher Texte/Nombre) reste
 * visuellement fixe à l'ouverture/fermeture du panneau, au lieu d'être
 * décalé — le contenu au-dessus défile à la place.
 *
 * Un transform plutôt qu'un scrollTop : sur une note vide ou courte, le
 * conteneur n'a aucun overflow réel (scrollHeight === clientHeight), donc
 * `scrollTop` n'a nulle part où aller et la compensation ne fait rien — le
 * panneau déborde sous le viewport sans qu'on puisse l'atteindre. Un
 * transform déplace le contenu peint indépendamment de tout overflow réel :
 * il fonctionne quelle que soit la longueur de la note, et se compose sans
 * conflit avec un vrai scroll quand celui-ci existe par ailleurs.
 *
 * Limite connue : le contenu masqué au-dessus (translaté hors champ) n'est
 * pas re-scrollable pendant que le panneau est ouvert — la molette n'a pas de
 * prise sur un transform. Une tentative de le rendre re-scrollable (réserver
 * un vrai overflow via un padding temporaire, puis animer scrollTop) a
 * régressé cette compensation elle-même sans qu'on puisse la déboguer en
 * direct — abandonnée, cf. conversation.
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
  const contentRoot = useAtomValue(noteContentRootAtom);
  const rowGapRef = useRef(0);
  const wasExpandedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  // Décalage actuellement appliqué (px, vers le haut) — seule source de
  // vérité pour un transform (contrairement à scrollTop, rien d'autre ne le
  // reflète : pas d'équivalent à container.scrollTop à relire).
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!rendered) return;
    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;
    const rowGap = Number.parseFloat(getComputedStyle(parent).rowGap);
    rowGapRef.current = Number.isNaN(rowGap) ? 0 : rowGap;
  }, [rendered, wrapperRef]);

  useEffect(() => {
    if (!contentRoot || contentHeight <= 0) return;

    function animateBy(delta: number) {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      const from = offsetRef.current;
      const t0 = performance.now();
      function step(now: number) {
        const t = Math.min((now - t0) / CLOSE_TRANSITION_MS, 1);
        const eased = tailwindEaseOut(t);
        const current = from + delta * eased;
        offsetRef.current = current;
        if (contentRoot) {
          contentRoot.style.transform =
            current === 0 ? "" : `translateY(${-current}px)`;
        }
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
  }, [expanded, contentRoot, contentHeight]);

  // Sécurité : si ce composant se démonte pendant qu'il maintenait un décalage
  // non nul (ex. suppression de la propriété pendant que son panneau était
  // encore ouvert/en cours d'animation), remet le contenu en place — un
  // scrollTop abandonné reste une position valide, un transform abandonné
  // resterait bloqué indéfiniment sans ça (rien d'autre ne le remettrait à zéro).
  useEffect(() => {
    return () => {
      if (offsetRef.current !== 0 && contentRoot) {
        contentRoot.style.transform = "";
      }
    };
  }, [contentRoot]);
}
