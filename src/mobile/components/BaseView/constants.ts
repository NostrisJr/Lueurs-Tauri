/**
 * Décalage du bandeau collant d'une base (barre de vue + en-tête de colonnes)
 * sous la zone réservée à la barre flottante.
 *
 * Partagé avec MobileEditor : le masque de fondu du scroller doit redevenir
 * totalement opaque pile au bord haut de ce bandeau (FLOATING_HEADER_SCROLL_OFFSET
 * + cette valeur), sinon le dégradé traverse le bandeau lui-même — son fond
 * devient translucide et les lignes se voient défiler derrière.
 */
export const BASE_STICKY_TOP = 16;
