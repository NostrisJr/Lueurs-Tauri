import clsx from "clsx";
import type { ReactNode } from "react";
import { IconWaveform } from "../../../shared/components/PlatformIcon";
import { getHighlightBg } from "../../../shared/plugins/highlight/colors";
import type {
  BadgeKind,
  InlineSegment,
  PreviewBlock,
} from "./parseMarkdownPreview";

const BADGE_ICON: Record<BadgeKind, ReactNode> = {
  image: "🖼",
  code: "🖥",
  table: "📊",
  formula: "ƒ",
  audio: <IconWaveform className="size-3.5" aria-hidden="true" />,
};

function Segment({
  segment,
  respectLineBreaks,
}: {
  segment: InlineSegment;
  respectLineBreaks: boolean;
}) {
  switch (segment.type) {
    case "linebreak":
      // Aperçus tronqués (line-clamp) : un espace, la troncature visuelle
      // recompose déjà le flux. Aperçus non tronqués (long-press, onglets) :
      // vrai saut de ligne, pour respecter la mise en vers d'un poème.
      return respectLineBreaks ? <br /> : " ";
    case "bold":
      return <strong className="font-semibold">{segment.value}</strong>;
    case "italic":
    case "didascalie":
      return <em>{segment.value}</em>;
    case "strike":
      return <span className="line-through">{segment.value}</span>;
    case "code":
      return (
        <code
          className={clsx(
            "font-mono text-[0.85em] rounded px-1",
            "bg-surface-3"
          )}
        >
          {segment.value}
        </code>
      );
    case "highlight":
      return (
        // Le fond vient des tokens de surlignage, pas d'une table locale :
        // l'aperçu doit montrer exactement la couleur de l'éditeur. L'ancienne
        // table ignorait `gray` (surlignage gris rendu sans fond) et prévoyait
        // un `pink` que la palette ne produit pas.
        <span
          className="rounded px-0.5"
          style={{ background: getHighlightBg(segment.color) }}
        >
          {segment.value}
        </span>
      );
    case "badge":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {BADGE_ICON[segment.kind]}
          {segment.label && ` ${segment.label}`}
        </span>
      );
    default:
      return <>{segment.value}</>;
  }
}

function Segments({
  segments,
  respectLineBreaks,
}: {
  segments: InlineSegment[];
  respectLineBreaks: boolean;
}) {
  return (
    <>
      {segments.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments statiques
        <Segment key={i} segment={s} respectLineBreaks={respectLineBreaks} />
      ))}
    </>
  );
}

function Block({
  block,
  respectLineBreaks,
}: {
  block: PreviewBlock;
  respectLineBreaks: boolean;
}) {
  switch (block.type) {
    case "heading":
      return (
        <p
          className={clsx(
            "m-0",
            block.level <= 2 ? "font-bold" : "font-semibold"
          )}
        >
          <Segments
            segments={block.segments}
            respectLineBreaks={respectLineBreaks}
          />
        </p>
      );
    case "item":
      return (
        <p className={clsx("m-0", block.checked && "line-through opacity-70")}>
          {block.checked === undefined ? "• " : block.checked ? "☑ " : "☐ "}
          <Segments
            segments={block.segments}
            respectLineBreaks={respectLineBreaks}
          />
        </p>
      );
    case "quote":
      return (
        <p className="m-0 italic">
          <Segments
            segments={block.segments}
            respectLineBreaks={respectLineBreaks}
          />
        </p>
      );
    case "badge":
      return (
        <p className="m-0 inline-flex items-center gap-1">
          {BADGE_ICON[block.kind]} {block.label}
        </p>
      );
    default:
      return (
        <p className="m-0">
          <Segments
            segments={block.segments}
            respectLineBreaks={respectLineBreaks}
          />
        </p>
      );
  }
}

interface Props {
  blocks: PreviewBlock[];
  className?: string;
  /** Espace entre blocs (aperçu long-press) ; tassé par défaut pour ne pas
   * fausser le calcul de line-clamp dans les aperçus tronqués. */
  spaced?: boolean;
  /** Rend les sauts de vers (poésie) comme de vrais <br/> au lieu de les
   * réduire à un espace. À activer pour les aperçus non tronqués (long-press,
   * onglets) ; laisser à false pour les aperçus en line-clamp (file tree,
   * Kanban, corbeille) où la troncature visuelle recompose déjà le flux. */
  respectLineBreaks?: boolean;
}

/** Rendu React des blocs produits par `parsePreviewBlocks` — un mini-rendu
 * markdown pensé pour les aperçus (pas l'éditeur complet). */
export function MarkdownPreview({
  blocks,
  className,
  spaced,
  respectLineBreaks = false,
}: Props) {
  if (blocks.length === 0) return null;
  return (
    <div className={clsx(className, spaced && "space-y-1")}>
      {blocks.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocs statiques
        <Block key={i} block={b} respectLineBreaks={respectLineBreaks} />
      ))}
    </div>
  );
}
