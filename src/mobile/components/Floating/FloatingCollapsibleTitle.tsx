/**
 * FloatingCollapsibleTitle.tsx
 *
 * Titre centré "headerless" qui rétrécit sur place au scroll (police
 * seulement), sans déplacement horizontal — variante simplifiée du morph de
 * MobileNoteTitle (cf. FloatingHeaderBar) : utilisable dès que le titre est
 * déjà centré et tient sur une seule ligne (file tree, onglets…), donc pas
 * besoin de portail ni de mesure de rect, juste une interpolation de taille
 * en place, pilotée par `collapseProgress`.
 *
 * Pas de fond pill (texte nu), à dessein — même choix que MobileNoteTitle
 * dans l'éditeur (cf. son commentaire) : seuls les boutons d'icône de la
 * barre flottante (retour, menu…) matérialisent une pill au scroll.
 */

import clsx from "clsx";
import { forwardRef } from "react";

// Repris de MobileNoteTitle (mêmes valeurs) pour une cohérence visuelle du
// morph dans toute l'appli — cf. Editor/MobileNoteTitle.tsx.
const TITLE_FONT_SIZE = 24;
const PILL_FONT_SIZE = 14;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  /** Progression (0-1) du rétrécissement — pilotée par le scroll du parent. */
  collapseProgress: number;
}

export const FloatingCollapsibleTitle = forwardRef<HTMLSpanElement, Props>(
  function FloatingCollapsibleTitle(
    { text, collapseProgress, className, style, ...rest },
    ref
  ) {
    const t = collapseProgress;
    return (
      <div className="relative w-3/4 mx-auto h-8 flex items-center justify-center">
        <span
          ref={ref}
          {...rest}
          className={clsx(
            "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold tracking-tight",
            "text-ink",
            className
          )}
          style={{
            ...style,
            fontSize: lerp(TITLE_FONT_SIZE, PILL_FONT_SIZE, t),
          }}
        >
          {text}
        </span>
      </div>
    );
  }
);
