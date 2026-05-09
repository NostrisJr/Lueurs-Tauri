import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorState } from "@milkdown/kit/prose/state";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";

const wordHighlightKey = new PluginKey<DecorationSet>("wordHighlight");

const WORD_CHAR = /[a-zA-ZÀ-ÖØ-öø-ÿ0-9_'']/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findOccurrences(doc: ProsemirrorNode, word: string): Array<{ from: number; to: number }> {
  const results: Array<{ from: number; to: number }> = [];
  const re = new RegExp(escapeRegex(word), "gi");

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      const charBefore = m.index > 0 ? node.text[m.index - 1] : null;
      const charAfter = m.index + word.length < node.text.length ? node.text[m.index + word.length] : null;
      if (charBefore && WORD_CHAR.test(charBefore)) continue;
      if (charAfter && WORD_CHAR.test(charAfter)) continue;
      results.push({ from: pos + m.index, to: pos + m.index + word.length });
    }
  });

  return results;
}

function buildDecorations(state: EditorState): DecorationSet {
  const { from, to } = state.selection;

  if (from === to) return DecorationSet.empty;

  // Normalise les séparateurs de blocs en espaces, puis enlève les espaces en bout de sélection
  const text = state.doc.textBetween(from, to, " ").trim();

  // Doit avoir au moins 2 chars et commencer/finir par un caractère de mot
  if (text.length < 2) return DecorationSet.empty;
  if (!WORD_CHAR.test(text[0]) || !WORD_CHAR.test(text[text.length - 1])) return DecorationSet.empty;

  const occurrences = findOccurrences(state.doc, text);
  if (occurrences.length < 2) return DecorationSet.empty;

  // Exclut l'occurrence qui chevauche la sélection courante (le mot sélectionné lui-même)
  const decos = occurrences
    .filter(({ from: f, to: t }) => t <= from || f >= to)
    .map(({ from: f, to: t }) =>
      Decoration.inline(f, t, { class: "word-occurrence" })
    );

  return DecorationSet.create(state.doc, decos);
}

export const wordHighlightPlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: wordHighlightKey,
      state: {
        init: (_config, state) => buildDecorations(state),
        apply(tr, prevDecos, _oldState, newState) {
          if (!tr.selectionSet && !tr.docChanged) return prevDecos;
          return buildDecorations(newState);
        },
      },
      props: {
        decorations(state) {
          return wordHighlightKey.getState(state);
        },
      },
    })
);
