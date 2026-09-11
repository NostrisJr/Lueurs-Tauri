/** Parseur markdown léger dédié aux aperçus mobiles (file tree, onglets, Kanban,
 * corbeille, aperçu long-press) : produit des blocs/segments structurés plutôt
 * que du texte nettoyé, pour permettre un rendu avec mise en forme (gras,
 * italique, listes...) tronqué visuellement en CSS (line-clamp) plutôt que par
 * découpage de chaînes — ce qui montre le vrai début du rendu de la note et non
 * le début des N premiers paragraphes sources. */

const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|flac|aac|opus|weba|webm)(\?|#|$)/i;

// Les badges renvoient un "kind" plutôt qu'un glyphe en dur : ce module reste
// un parseur pur (pas d'import React/icônes), le rendu choisit l'icône par kind.
export type BadgeKind = "image" | "code" | "table" | "formula" | "audio";

export type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "code"; value: string }
  | { type: "didascalie"; value: string }
  | { type: "highlight"; value: string; color: string }
  | { type: "badge"; kind: BadgeKind; label: string }
  | { type: "linebreak" };

export type PreviewBlock =
  | { type: "heading"; level: number; segments: InlineSegment[] }
  | { type: "paragraph"; segments: InlineSegment[] }
  | { type: "item"; checked?: boolean; segments: InlineSegment[] }
  | { type: "quote"; segments: InlineSegment[] }
  | { type: "badge"; kind: BadgeKind; label: string };

// Ordre important seulement entre alternatives partageant le même délimiteur
// de départ (ex: ** avant * pour que le gras l'emporte sur l'italique).
const INLINE_RE =
  /!\[(?<imgAlt>[^\]]*)\]\([^)]+\)|\$\$(?<formula>[^\n$]+?)\$\$|<br\s*\/?>(?<br>)|\[(?<linkText>[^\]]+)\]\([^)]+\)|`(?<code>[^`]+)`|==(?:\{(?<hlColor>[a-z]+)\})?(?<hl>[^=]+)==|\|\|(?<dida>[^|]+)\|\||\*\*(?<bold1>[^*]+)\*\*|__(?<bold2>[^_]+)__|~~(?<strike>[^~]+)~~|\*(?<italic1>[^*]+)\*|_(?<italic2>[^_]+)_/g;

function parseInline(rawText: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null = INLINE_RE.exec(rawText);
  while (match) {
    if (match.index > lastIndex) {
      const value = rawText.slice(lastIndex, match.index);
      if (value) segments.push({ type: "text", value });
    }
    const g = match.groups as Record<string, string | undefined>;
    if (g.imgAlt !== undefined) {
      segments.push({
        type: "badge",
        kind: "image",
        label: g.imgAlt || "Image",
      });
    } else if (g.formula !== undefined) {
      // Résultat non calculable hors éditeur : ƒ + [...] = "texte en construction".
      segments.push({ type: "badge", kind: "formula", label: "[...]" });
    } else if (g.br !== undefined) {
      // Saut de vers (poésie) : segment à part — c'est au rendu (via
      // `respectLineBreaks`) de décider de l'afficher comme <br/> ou de le
      // réduire à un espace (aperçus tronqués en line-clamp).
      segments.push({ type: "linebreak" });
    } else if (g.linkText !== undefined) {
      segments.push({ type: "text", value: g.linkText });
    } else if (g.code !== undefined) {
      segments.push({ type: "code", value: g.code });
    } else if (g.hl !== undefined) {
      segments.push({
        type: "highlight",
        value: g.hl.trim(),
        color: g.hlColor ?? "yellow",
      });
    } else if (g.dida !== undefined) {
      segments.push({ type: "didascalie", value: g.dida });
    } else if (g.bold1 !== undefined || g.bold2 !== undefined) {
      segments.push({ type: "bold", value: (g.bold1 ?? g.bold2) as string });
    } else if (g.strike !== undefined) {
      segments.push({ type: "strike", value: g.strike });
    } else if (g.italic1 !== undefined || g.italic2 !== undefined) {
      segments.push({
        type: "italic",
        value: (g.italic1 ?? g.italic2) as string,
      });
    }
    lastIndex = match.index + match[0].length;
    match = INLINE_RE.exec(rawText);
  }
  if (lastIndex < rawText.length) {
    const value = rawText.slice(lastIndex);
    if (value) segments.push({ type: "text", value });
  }
  return segments;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const QUOTE_RE = /^>\s?(.*)$/;
const ITEM_RE = /^(?:[-*+]|\d+\.)\s+(.*)$/;
const CHECKBOX_RE = /^\[( |x|X)\]\s+(.*)$/;
const FENCE_RE = /^```/;
const STANDALONE_IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const STANDALONE_LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;
const TABLE_ROW_RE = /^\|.*\|$/;
const POETRY_MARK_RE = /^§§$/;

/** Extrait les premiers blocs "visibles" d'un body markdown, dans l'ordre du
 * document, avec un plafond de blocs (pas de lignes : la troncature visuelle
 * finale se fait en CSS via line-clamp côté appelant). */
export function parsePreviewBlocks(
  body: string,
  maxBlocks = 16
): PreviewBlock[] {
  const stripped = body.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const rawLines = stripped.split("\n");
  const blocks: PreviewBlock[] = [];
  let paragraphBuf: string[] = [];

  function flushParagraph() {
    if (paragraphBuf.length === 0) return;
    const segments = parseInline(paragraphBuf.join(" "));
    paragraphBuf = [];
    if (segments.length > 0) blocks.push({ type: "paragraph", segments });
  }

  for (let i = 0; i < rawLines.length && blocks.length < maxBlocks; i++) {
    const line = rawLines[i].trim();

    if (line === "" || POETRY_MARK_RE.test(line)) {
      flushParagraph();
      continue;
    }

    if (FENCE_RE.test(line)) {
      flushParagraph();
      blocks.push({ type: "badge", kind: "code", label: "Bloc de code" });
      i++;
      while (i < rawLines.length && !FENCE_RE.test(rawLines[i].trim())) i++;
      continue;
    }

    if (TABLE_ROW_RE.test(line)) {
      flushParagraph();
      blocks.push({ type: "badge", kind: "table", label: "Tableau" });
      while (
        i + 1 < rawLines.length &&
        TABLE_ROW_RE.test(rawLines[i + 1].trim())
      )
        i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      flushParagraph();
      const segments = parseInline(heading[2]);
      if (segments.length > 0)
        blocks.push({ type: "heading", level: heading[1].length, segments });
      continue;
    }

    if (HR_RE.test(line)) {
      flushParagraph();
      continue;
    }

    const quote = line.match(QUOTE_RE);
    if (quote) {
      flushParagraph();
      const segments = parseInline(quote[1]);
      if (segments.length > 0) blocks.push({ type: "quote", segments });
      continue;
    }

    const standaloneLink = line.match(STANDALONE_LINK_RE);
    if (standaloneLink && AUDIO_EXT_RE.test(standaloneLink[2])) {
      flushParagraph();
      blocks.push({
        type: "badge",
        kind: "audio",
        label: standaloneLink[1] || "Audio",
      });
      continue;
    }

    const standaloneImage = line.match(STANDALONE_IMAGE_RE);
    if (standaloneImage) {
      flushParagraph();
      blocks.push({
        type: "badge",
        kind: "image",
        label: standaloneImage[1] || "Image",
      });
      continue;
    }

    const item = line.match(ITEM_RE);
    if (item) {
      flushParagraph();
      const checkbox = item[1].match(CHECKBOX_RE);
      const rest = checkbox ? checkbox[2] : item[1];
      const segments = parseInline(rest);
      if (segments.length > 0) {
        blocks.push({
          type: "item",
          checked: checkbox ? checkbox[1].toLowerCase() === "x" : undefined,
          segments,
        });
      }
      continue;
    }

    paragraphBuf.push(line);
  }
  flushParagraph();
  return blocks.slice(0, maxBlocks);
}
