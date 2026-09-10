import { useRef, useState } from "react";
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
  const dotColor = color ? getHighlightSolid(color) : "#d1d5db";

  return (
    <>
      <button
        ref={dotRef}
        type="button"
        title={title ?? "Changer la couleur"}
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
            className="flex flex-wrap gap-1.5 p-2 w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                onClick={(e) => {
                  e.stopPropagation();
                  onColor(c.id);
                  setOpen(false);
                }}
                className="size-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c.solid,
                  borderColor: color === c.id ? "#374151" : "transparent",
                }}
              />
            ))}
            <button
              type="button"
              title="Aucune couleur"
              onClick={(e) => {
                e.stopPropagation();
                onColor(undefined);
                setOpen(false);
              }}
              className="size-5 rounded-full border border-gray-200 bg-white text-gray-400 text-[11px] flex items-center justify-center hover:bg-red-50 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        </AnchoredDropdown>
      )}
    </>
  );
}
