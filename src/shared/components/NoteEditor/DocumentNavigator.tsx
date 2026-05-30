import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import {
  documentMapDistinguishedTypesAtom,
  documentMapForActiveAtom,
  documentMapShowListsAtom,
  documentMapShowNavigatorAtom,
  documentMapShowTextAtom,
  scrollToPosAtom,
} from "../../lib/atoms";
import { BLOCK_TYPE_COLORS } from "../../lib/documentMapConfig";

const DOT_TYPES = new Set(["image", "audio_block"]);

// Largeurs px des barres de titre par niveau (conteneur = 20px)
const HEADING_WIDTHS = ["w-5", "w-4", "w-[13px]", "w-2.5", "w-2", "w-1.5"];
// Épaisseurs des barres de titre par niveau
const HEADING_HEIGHTS = [
  "h-[2.5px]",
  "h-0.5",
  "h-[1.5px]",
  "h-[1.5px]",
  "h-[1.5px]",
  "h-[1.5px]",
];

function findScrollContainer(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const { overflow, overflowY } = getComputedStyle(parent);
    if (/(auto|scroll)/.test(overflow + overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
}

// Rendu à l'intérieur du wrapper sticky de NoteEditor (height: 0, overflow: visible)
export function DocumentNavigator() {
  const { blocks, docSize } = useAtomValue(documentMapForActiveAtom);
  const distinguishedTypes = useAtomValue(documentMapDistinguishedTypesAtom);
  const showNavigator = useAtomValue(documentMapShowNavigatorAtom);
  const showLists = useAtomValue(documentMapShowListsAtom);
  const showText = useAtomValue(documentMapShowTextAtom);
  const setScrollToPos = useSetAtom(scrollToPosAtom);

  const clipRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Scroll sync : fait défiler le navigateur avec la page, juste assez pour
  // montrer le bas, puis s'arrête.
  useEffect(() => {
    const clip = clipRef.current;
    const inner = innerRef.current;
    if (!clip || !inner) return;

    const scrollEl = findScrollContainer(clip);
    if (!scrollEl) return;

    const sync = () => {
      const overflow = inner.scrollHeight - clip.clientHeight;
      if (overflow <= 0) {
        inner.style.transform = "";
        return;
      }
      const translate = Math.min(scrollEl.scrollTop, overflow);
      inner.style.transform = `translateY(-${translate}px)`;
    };

    scrollEl.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(inner);
    sync();

    return () => {
      scrollEl.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  if (!showNavigator || docSize === 0) return null;

  return (
    // Conteneur clippé : limite la hauteur visible à la fenêtre
    <div
      ref={clipRef}
      className="absolute right-5 top-10 w-5 overflow-hidden"
      //TODO : faire un calcul propre avec la hauteur du header ? là le 150px est un peu au doigt mouillé
      style={{ maxHeight: "calc(100vh - 150px)" }}
    >
      {/* Contenu translateY en sync avec le scroll de la page */}
      <div ref={innerRef} className="flex flex-col items-end gap-1.25">
        {blocks.map((block) => {
          // ── Titres : barre horizontale, largeur ∝ niveau ──
          if (block.typeName === "heading") {
            const lvl = Math.max(0, Math.min(5, (block.level ?? 1) - 1));
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
              <div
                key={block.pos}
                data-nav-mark
                className={`${HEADING_WIDTHS[lvl]} ${HEADING_HEIGHTS[lvl]} bg-gray-400/70 rounded-[1px] shrink-0 cursor-pointer hover:bg-gray-400/90 transition-colors`}
                onClick={() => setScrollToPos(block.pos)}
              />
            );
          }

          // ── Blocs distingués ──
          if (distinguishedTypes.includes(block.typeName)) {
            const color =
              (BLOCK_TYPE_COLORS as Record<string, string>)[block.typeName] ??
              "#6b7280";

            // Objets (image, audio) → point rond
            if (DOT_TYPES.has(block.typeName)) {
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
                <div
                  key={block.pos}
                  data-nav-mark
                  className="w-1 h-1 rounded-full shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                  style={{ background: color }}
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
                className="w-0.5 h-2 shrink-0 cursor-pointer opacity-75 hover:opacity-100 transition-opacity"
                style={{ background: color }}
                onClick={() => setScrollToPos(block.pos)}
              />
            );
          }

          // ── Texte et listes : barre muted, si activés ──
          if (
            (block.typeName === "paragraph" && showText) ||
            (block.typeName === "list" && showLists)
          ) {
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
              <div
                key={block.pos}
                data-nav-mark
                className="w-0.5 h-1.75 shrink-0 cursor-pointer bg-gray-500/20 hover:bg-gray-500/30 transition-colors"
                onClick={() => setScrollToPos(block.pos)}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
