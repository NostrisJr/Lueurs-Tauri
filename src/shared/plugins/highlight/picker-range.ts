import type { MarkType } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";

export type PickerRange = { from: number; to: number };

// Étend la position survolée à toute la plage contiguë portant la marque
// highlight de même couleur (la marque peut couvrir plusieurs text nodes si
// du gras/italique la traverse).
export function highlightRangeAt(
  state: EditorState,
  pos: number,
  hlType: MarkType
): (PickerRange & { color: string }) | null {
  const $pos = state.doc.resolve(pos);
  const after = $pos.nodeAfter;
  const mark = after && hlType.isInSet(after.marks);
  if (!after || !mark) return null;
  const color = mark.attrs.color as string;

  let from = pos;
  let to = pos + after.nodeSize;
  for (;;) {
    const before = state.doc.resolve(from).nodeBefore;
    const m = before && hlType.isInSet(before.marks);
    if (before && m && m.attrs.color === color) from -= before.nodeSize;
    else break;
  }
  for (;;) {
    const next = state.doc.resolve(to).nodeAfter;
    const m = next && hlType.isInSet(next.marks);
    if (next && m && m.attrs.color === color) to += next.nodeSize;
    else break;
  }
  return { from, to, color };
}

// Suit la plage à travers une transaction : la pastille est une décoration
// ancrée dans le document, elle doit rester sur son texte quand il bouge.
export function mapPickerRange(
  range: PickerRange | null,
  map: (pos: number, assoc: number) => number
): PickerRange | null {
  if (!range) return null;
  const from = map(range.from, 1);
  const to = map(range.to, -1);
  return from < to ? { from, to } : null;
}
