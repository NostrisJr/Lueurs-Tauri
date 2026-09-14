import clsx from "clsx";
import { useRef, useState } from "react";
import { isMobile } from "../../lib/platform";
import {
  HIGHLIGHT_COLORS,
  getHighlightSolid,
} from "../../plugins/highlight/colors";
import { AnchoredDropdown } from "../AnchoredDropdown";

interface Props {
  /** Couleur actuelle (id highlight) ou undefined = neutre. */
  color: string | undefined;
  /** Nouvelle couleur choisie (undefined = retirer la couleur). */
  onColor: (color: string | undefined) => void;
  /** Classes du bouton-pastille — positionnement/opacité selon le contexte. */
  className?: string;
  title?: string;
  /**
   * Cf. AnchoredDropdownProps.zIndex — nécessaire quand ce picker est rendu à
   * l'intérieur d'un popup déjà empilé (ex: InlineFormulaPopup, z-50).
   */
  zIndex?: number;
}

/**
 * Pastille cliquable ouvrant la palette de surlignage (même mécanisme que le
 * highlight md). Utilisée pour recolorer une option ENUM dans le panneau de
 * réglages du frontmatter (EnumOptionsFields) comme dans les colonnes Kanban.
 * Le dropdown étant positionné en fixed via le ref, aucun parent relatif requis.
 */
export function ColorDotPicker({
  color,
  onColor,
  className,
  title,
  zIndex,
}: Props) {
  const [open, setOpen] = useState(false);
  const dotRef = useRef<HTMLButtonElement>(null);
  // Pas de couleur choisie → pastille grise (même gris que le pill neutre,
  // cf. enumPillColors.NEUTRAL_PILL), jamais la couleur jaune par défaut du
  // surlignage : la pastille doit prévisualiser le pill réel, pas suggérer
  // qu'une couleur est déjà active.
  const dotColor = color ? getHighlightSolid(color) : "var(--color-pill-gray)";

  return (
    <>
      <button
        ref={dotRef}
        type="button"
        title={title ?? "Changer la couleur"}
        // Empêche de voler le focus au champ actif (ex: le libellé d'une
        // option Bouton en cours de frappe) — sans ça, ouvrir cette palette
        // blurait l'input et fermait le clavier pour rien, alors qu'il peut
        // rester ouvert le temps de choisir une couleur (cf. le même pattern
        // sur la roue crantée, FrontmatterRow.tsx).
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={className}
        style={{ background: dotColor }}
      />
      {open && (
        <AnchoredDropdown
          anchorRef={dotRef}
          onClose={() => setOpen(false)}
          zIndex={zIndex}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: palette de couleurs */}
          <div
            className={clsx(
              "flex flex-wrap p-2",
              isMobile ? "gap-3 w-[180px]" : "gap-1.5 w-[120px]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onColor(c.id);
                  setOpen(false);
                }}
                className={clsx(
                  "rounded-full border-2 transition-transform hover:scale-110",
                  isMobile ? "size-9" : "size-5"
                )}
                style={{
                  background: getHighlightSolid(c.id),
                  borderColor:
                    color === c.id ? "var(--color-ink-2)" : "transparent",
                }}
              />
            ))}
            <button
              type="button"
              title="Aucune couleur"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onColor(undefined);
                setOpen(false);
              }}
              className={clsx(
                "rounded-full border flex items-center justify-center",
                "border-line-2 bg-surface text-ink-4",
                "hover:bg-danger-soft hover:text-danger-2",
                isMobile ? "size-9 text-sm" : "size-5 text-[11px]"
              )}
            >
              ✕
            </button>
          </div>
        </AnchoredDropdown>
      )}
    </>
  );
}
