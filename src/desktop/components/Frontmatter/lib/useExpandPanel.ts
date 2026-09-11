import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

// Doit correspondre à la durée de transition CSS (duration-200) utilisée pour
// la hauteur des panneaux (cf. useAnimatedHeight) — le temps de laisser
// l'animation de fermeture se jouer avant de démonter réellement le contenu.
export const CLOSE_TRANSITION_MS = 200;

/**
 * Gère le déroulé en place d'un panneau d'édition dans une ligne de
 * frontmatter (remplace l'ancienne modale flottante) : transition d'ouverture
 * ET de fermeture (via `visible`, qui reste vrai le temps de l'animation de
 * repli).
 *
 * Fermeture UNIQUEMENT sur déclencheur explicite — Entrée, Échap, ou un
 * second clic sur la roue de réglages (commitAndClose) — jamais sur une perte
 * de focus détectée après coup. Une ancienne version fermait aussi sur blur
 * (avec un délai d'une frame pour vérifier où le focus atterrissait vraiment,
 * en excluant les popovers portalées comme NoteSelector) : entre l'ouverture
 * d'un sélecteur ref()/self[, sa fermeture après un choix, et le focus qui
 * repart sur ce champ, il y a plusieurs allers-retours de focus dont l'ORDRE
 * relatif (rAF vs micro/macrotask du re-render React) n'est pas garanti —
 * le panneau pouvait se refermer juste après une sélection, avec un brouillon
 * pas encore à jour (→ #ERREUR affiché, corrigé seulement en committant la
 * VRAIE valeur juste avant de fermer). Les boutons qui doivent changer l'état
 * du panneau sans le refermer (roue, onglets Texte/Nombre/Bouton) empêchent
 * déjà eux-mêmes ce vol de focus via `onMouseDown={e => e.preventDefault()}` —
 * il n'y a donc plus besoin de deviner après coup si un blur était légitime.
 *
 * `commit` est lu à chaque fermeture (via containerProps ou handleFieldDone),
 * donc toujours la version la plus récente passée par l'appelant — pas de ref
 * nécessaire côté appelant.
 */
export function useExpandPanel(
  expanded: boolean,
  close: () => void,
  commit: () => void
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setVisible(true);
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    // Fermeture : on retransitionne d'abord vers replié, puis on démonte
    // réellement une fois l'animation terminée.
    setMounted(false);
    const timeout = setTimeout(() => setVisible(false), CLOSE_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [expanded]);

  function commitAndClose() {
    commit();
    close();
  }

  const containerProps = {
    ref: panelRef,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        commitAndClose();
      }
    },
  };

  return {
    mounted,
    visible,
    // Fin d'édition du champ formule (Entrée/Échap dans FormulaEditField, plus
    // de blur — cf. commentaire ci-dessus) : même fermeture explicite que le
    // reste du panneau.
    handleFieldDone: commitAndClose,
    containerProps,
    commitAndClose,
  };
}
