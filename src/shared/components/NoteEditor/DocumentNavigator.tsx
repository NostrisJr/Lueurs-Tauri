import { useAtomValue, useSetAtom } from "jotai";
import {
  documentMapAtom,
  documentMapDistinguishedTypesAtom,
  documentMapShowListsAtom,
  documentMapShowNavigatorAtom,
  documentMapShowTextAtom,
  scrollToPosAtom,
} from "../../lib/Atoms";
import { BLOCK_TYPE_COLORS } from "../../lib/documentMapConfig";

// Largeur (%) des barres de titre par niveau — H1 = pleine largeur
const HEADING_WIDTHS = ["100%", "82%", "64%", "50%", "38%", "28%"];
// Épaisseur des barres de titre par niveau
const HEADING_HEIGHTS = [2.5, 2, 1.5, 1.5, 1.5, 1.5];

// Types représentés par un point (objet sans structure linéaire)
const DOT_TYPES = new Set(["image", "audio_block"]);

const TEXT_MARK_COLOR = "#6b7280";

// Rendu à l'intérieur du wrapper sticky de NoteEditor (height: 0, overflow: visible)
// Le conteneur est positionné en absolu dans ce wrapper.
export function DocumentNavigator() {
  const { blocks, docSize } = useAtomValue(documentMapAtom);
  const distinguishedTypes = useAtomValue(documentMapDistinguishedTypesAtom);
  const showNavigator = useAtomValue(documentMapShowNavigatorAtom);
  const showLists = useAtomValue(documentMapShowListsAtom);
  const showText = useAtomValue(documentMapShowTextAtom);
  const setScrollToPos = useSetAtom(scrollToPosAtom);

  if (!showNavigator || docSize === 0) return null;

  return (
    <div
      className="absolute right-5 top-10 w-5 flex flex-col items-end gap-2 overflow-visible"
      style={{ pointerEvents: "none" }}
    >
      {blocks.map((block) => {
        // ── Titres : barre horizontale, largeur ∝ niveau ──
        if (block.typeName === "heading") {
          const lvl = Math.max(0, Math.min(5, (block.level ?? 1) - 1));
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
            <div
              key={block.pos}
              data-nav-mark
              style={{
                width: HEADING_WIDTHS[lvl],
                height: HEADING_HEIGHTS[lvl],
                background: "#9ca3af",
                opacity: 0.7,
                borderRadius: 1,
                flexShrink: 0,
                pointerEvents: "auto",
              }}
              onClick={() => setScrollToPos(block.pos)}
            />
          );
        }

        // ── Blocs distingués ──
        if (distinguishedTypes.includes(block.typeName)) {
          const color =
            (BLOCK_TYPE_COLORS as Record<string, string>)[block.typeName] ??
            TEXT_MARK_COLOR;

          // Objets (image, audio) → point rond
          if (DOT_TYPES.has(block.typeName)) {
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
              <div
                key={block.pos}
                data-nav-mark
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: color,
                  opacity: 0.8,
                  flexShrink: 0,
                  pointerEvents: "auto",
                }}
                onClick={() => setScrollToPos(block.pos)}
              />
            );
          }

          // Blocs structurés → barre verticale fine
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
            <div
              key={block.pos}
              data-nav-mark
              style={{
                width: 2,
                height: 8,
                background: color,
                opacity: 0.75,
                borderRadius: 1,
                flexShrink: 0,
                pointerEvents: "auto",
              }}
              onClick={() => setScrollToPos(block.pos)}
            />
          );
        }

        // ── Texte et listes : barre verticale muted, si activés ──
        if (
          (block.typeName === "paragraph" && showText) ||
          (block.typeName === "list" && showLists)
        ) {
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
            <div
              key={block.pos}
              data-nav-mark
              style={{
                width: 2,
                height: 7,
                background: TEXT_MARK_COLOR,
                opacity: 0.18,
                borderRadius: 1,
                flexShrink: 0,
                pointerEvents: "auto",
              }}
              onClick={() => setScrollToPos(block.pos)}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
