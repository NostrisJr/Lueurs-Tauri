import type { Node } from "@milkdown/kit/prose/model";

const IGNORED_NODE_TYPES = new Set([
  "code_block",
  "fence",
  "code",
  "math_block",
]);

export interface TextSegment {
  text: string;
  pmStart: number; // position absolue ProseMirror du premier caractère
}

export interface ExtractResult {
  plainText: string;
  segments: TextSegment[];
}

export function extractText(doc: Node): ExtractResult {
  const segments: TextSegment[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const $pos = doc.resolve(pos);
    const parent = $pos.parent;
    if (IGNORED_NODE_TYPES.has(parent.type.name)) return false;
    segments.push({ text: node.text, pmStart: pos });
    return true;
  });

  let plainText = "";
  for (const seg of segments) {
    plainText += seg.text + " ";
  }

  return { plainText: plainText.trimEnd(), segments };
}

// Convertit un offset dans plainText → position ProseMirror absolue
export function offsetToPmPos(offset: number, segments: TextSegment[]): number {
  let accumulated = 0;
  for (const seg of segments) {
    const end = accumulated + seg.text.length;
    if (offset <= end) {
      return seg.pmStart + (offset - accumulated);
    }
    accumulated += seg.text.length + 1; // +1 pour l'espace intercalée
  }
  return 0;
}
