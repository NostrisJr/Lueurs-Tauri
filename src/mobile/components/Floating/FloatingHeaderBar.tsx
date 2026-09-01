/**
 * FloatingHeaderBar.tsx
 *
 * Barre du haut "headerless" réutilisable (éditeur mobile, et bientôt file
 * tree). Trois slots (gauche / centre / droite) nus au repos ; au scroll,
 * chacun matérialise une pill vitrée (FloatingComponent) derrière son contenu
 * — opacité/scale animés, jamais de montage/démontage, pour un morphing doux
 * plutôt qu'une apparition brutale.
 *
 * Pure présentation : le parent pilote entièrement `collapsed` (seuil de
 * scroll, hystérésis…) et le contenu de chaque slot (ex: un titre qui ne
 * s'affiche que collapsed = à lui de gérer sa propre opacité).
 */

import clsx from "clsx";
import type { ReactNode } from "react";
import { isIOS } from "../../../shared/lib/platform";
import { FloatingComponent } from "./FloatingComponent";

// Hauteur du contenu de la barre (hors safe-area) — h-13.
export const FLOATING_HEADER_CONTENT_HEIGHT = 52;
// Décalage à réserver en haut d'un scroll container pour ne pas passer sous
// la barre (safe-area + contenu) : pt-23 (iOS) / pt-15 (Android). Sert aussi
// de hauteur au fondu de sortie de contenu sous la barre (cf. MobileEditor).
export const FLOATING_HEADER_SCROLL_OFFSET = isIOS ? 92 : 60;

// Géométrie brute de la barre (safe-area + insets + slots), exposée pour que
// le morph du titre (MobileNoteTitle) puisse calculer la position exacte du
// slot central sans avoir à mesurer le DOM du header — cf. pt-12/pt-4, px-3,
// size-13, gap-2 ci-dessous.
export const FLOATING_HEADER_TOP_OFFSET = isIOS ? 48 : 16;
export const FLOATING_HEADER_SIDE_INSET = 12;
export const FLOATING_HEADER_SLOT_SIZE = 52;
export const FLOATING_HEADER_SLOT_GAP = 8;
// Distance de scroll (px) sur laquelle se joue tout le morphing titre → pill.
export const TITLE_COLLAPSE_RANGE = 40;
// Zone morte (px) avant que le morph ne démarre — un petit scroll initial ne
// déclenche rien, le titre reste plein jusqu'à ce seuil.
export const TITLE_COLLAPSE_START = 24;

// Échelle de la pill à progress=0 (à peine visible derrière l'icône nue) — pas
// de transition CSS ici : la valeur suit `collapseProgress` image par image,
// donc reste toujours exactement synchrone avec le scroll (pas de durée fixe
// qui continuerait de jouer après un petit coup de scroll interrompu).
// Exportée : le morph du titre (MobileNoteTitle) dessine sa propre pill (elle
// doit épouser le texte, pas la pleine largeur du slot) et réutilise la même
// courbe de matérialisation pour rester visuellement cohérente avec les pills
// gauche/droite ci-dessous.
export const PILL_SCALE_START = 0.82;

function Slot({
  flex,
  collapseProgress,
  withPillBackground = true,
  children,
}: {
  flex?: boolean;
  collapseProgress: number;
  /** false pour un slot dont le contenu dessine sa propre pill (ex: le morph
   * du titre, dont la largeur ne correspond pas à celle du slot). */
  withPillBackground?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "relative flex items-center justify-center h-13",
        flex ? "flex-1 min-w-0" : "shrink-0 size-13"
      )}
    >
      {withPillBackground && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: collapseProgress,
            transform: `scale(${PILL_SCALE_START + (1 - PILL_SCALE_START) * collapseProgress})`,
          }}
        >
          <FloatingComponent wrapperClassName="w-full h-full" />
        </div>
      )}
      <div className="relative w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

interface FloatingHeaderBarProps {
  /** Progression de matérialisation des pills (0 = nu, 1 = pill pleine) — pilotée par le scroll du parent. */
  collapseProgress: number;
  left: ReactNode;
  center?: ReactNode;
  right: ReactNode;
}

export function FloatingHeaderBar({
  collapseProgress,
  left,
  center,
  right,
}: FloatingHeaderBarProps) {
  return (
    <div
      className={clsx("w-full fixed top-0 z-30 px-3", isIOS ? "pt-12" : "pt-4")}
    >
      <div className="w-full flex items-center justify-between gap-2 h-13">
        <Slot collapseProgress={collapseProgress}>{left}</Slot>
        <Slot
          collapseProgress={collapseProgress}
          flex
          withPillBackground={false}
        >
          {center}
        </Slot>
        <Slot collapseProgress={collapseProgress}>{right}</Slot>
      </div>
    </div>
  );
}
