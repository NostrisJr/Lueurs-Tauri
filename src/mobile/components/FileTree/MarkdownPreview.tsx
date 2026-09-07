import clsx from "clsx";
import type { InlineSegment, PreviewBlock } from "./parseMarkdownPreview";

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: "bg-yellow-200/60",
  green: "bg-green-200/60",
  blue: "bg-blue-200/60",
  pink: "bg-pink-200/60",
  red: "bg-red-200/60",
  purple: "bg-purple-200/60",
  orange: "bg-orange-200/60",
};

function Segment({ segment }: { segment: InlineSegment }) {
  switch (segment.type) {
    case "bold":
      return <strong className="font-semibold">{segment.value}</strong>;
    case "italic":
    case "didascalie":
      return <em>{segment.value}</em>;
    case "strike":
      return <span className="line-through">{segment.value}</span>;
    case "code":
      return (
        <code className="font-mono text-[0.85em] bg-gray-100 rounded px-1">
          {segment.value}
        </code>
      );
    case "highlight":
      return (
        <span
          className={clsx(
            "rounded px-0.5",
            HIGHLIGHT_BG[segment.color] ?? "bg-gray-200/60"
          )}
        >
          {segment.value}
        </span>
      );
    case "badge":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {segment.icon}
          {segment.label && ` ${segment.label}`}
        </span>
      );
    default:
      return <>{segment.value}</>;
  }
}

function Segments({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments statiques
        <Segment key={i} segment={s} />
      ))}
    </>
  );
}

function Block({ block }: { block: PreviewBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <p
          className={clsx(
            "m-0",
            block.level <= 2 ? "font-bold" : "font-semibold"
          )}
        >
          <Segments segments={block.segments} />
        </p>
      );
    case "item":
      return (
        <p className={clsx("m-0", block.checked && "line-through opacity-70")}>
          {block.checked === undefined ? "• " : block.checked ? "☑ " : "☐ "}
          <Segments segments={block.segments} />
        </p>
      );
    case "quote":
      return (
        <p className="m-0 italic">
          <Segments segments={block.segments} />
        </p>
      );
    case "badge":
      return (
        <p className="m-0 inline-flex items-center gap-1">
          {block.icon} {block.label}
        </p>
      );
    default:
      return (
        <p className="m-0">
          <Segments segments={block.segments} />
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
}

/** Rendu React des blocs produits par `parsePreviewBlocks` — un mini-rendu
 * markdown pensé pour les aperçus (pas l'éditeur complet). */
export function MarkdownPreview({ blocks, className, spaced }: Props) {
  if (blocks.length === 0) return null;
  return (
    <div className={clsx(className, spaced && "space-y-1")}>
      {blocks.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocs statiques
        <Block key={i} block={b} />
      ))}
    </div>
  );
}
