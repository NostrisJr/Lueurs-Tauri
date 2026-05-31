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
import clsx from "clsx";

const DOT_TYPES = new Set(["image", "audio_block"]);

// Largeurs px des barres de titre par niveau (conteneur = 20px)
const HEADING_WIDTHS = ["w-6", "w-5", "w-4", "w-3.5", "w-3", "w-2.5"];
// Épaisseurs des barres de titre par niveau
const HEADING_HEIGHT = "h-[2.5px]";

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
      className="absolute right-5 top-10 w-10 overflow-hidden"
      //TODO : faire un calcul propre avec la hauteur du header ? là le 150px est un peu au doigt mouillé
      style={{ maxHeight: "calc(100vh - 150px)" }}
    >
      {/* Contenu translateY en sync avec le scroll de la page */}
      <div ref={innerRef} className="flex flex-col items-end">
        {blocks.map((block) => {
          let inner: React.ReactNode = null;

          // ── Titres ──
          if (block.typeName === "heading") {
            const lvl = Math.max(0, Math.min(5, (block.level ?? 1) - 1));
            inner = (
              <div
                className={clsx(
                  `${HEADING_WIDTHS[lvl]}`,
                  HEADING_HEIGHT,
                  "bg-gray-400/70 rounded-full shrink-0 transition-all",
                  "group-hover:bg-gray-400/90 group-hover:scale-x-130 group-hover:scale-y-120 group-hover:translate-x-[-30%]"
                )}
              />
            );
          }

          // ── Blocs distingués ──
          else if (distinguishedTypes.includes(block.typeName)) {
            const color =
              (BLOCK_TYPE_COLORS as Record<string, string>)[block.typeName] ??
              "#6b7280";

            inner = DOT_TYPES.has(block.typeName) ? (
              <div
                className={clsx(
                  "size-1 rounded-full shrink-0 opacity-80 transition-all",
                  "group-hover:opacity-100 group-hover:size-2 group-hover:-translate-x-0.5"
                )}
                style={{ background: color }}
              />
            ) : (
              <div
                className={clsx(
                  "w-1 h-1 rounded-full shrink-0 opacity-75 transition-all",
                  "group-hover:opacity-100 group-hover:w-3 group-hover:h-1.5 group-hover:-translate-x-0.5"
                )}
                style={{ background: color }}
              />
            );
          }

          // ── Texte et listes ──
          else if (
            (block.typeName === "paragraph" && showText) ||
            (block.typeName === "list" && showLists)
          ) {
            inner = (
              <div
                className={clsx(
                  "w-0.5 h-1.75 shrink-0 bg-gray-500/20 group-hover:bg-gray-500/30 transition-all",
                  "group-hover:w-3 group-hover:-translate-x-0.5 group-hover:rounded-full"
                )}
              />
            );
          }

          if (inner === null) return null;

          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: minimap visuelle
            <div
              key={block.pos}
              className="flex items-center justify-end py-1 w-full group cursor-pointer"
              onClick={() => setScrollToPos(block.pos)}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
