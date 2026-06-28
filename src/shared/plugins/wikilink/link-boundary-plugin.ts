/**
 * link-boundary-plugin.ts
 *
 * La mark `link` du preset commonmark est inclusive : un caret collé à la fin
 * d'un lien (lien en bout de ligne sans espace, p. ex.) reste « dans » le lien,
 * et la frappe suivante s'ajoute au texte du lien. On rétablit le comportement
 * attendu (non-inclusif) : dès que le caret est à la frontière droite d'un lien,
 * on retire `link` des stored marks pour que la frappe sorte du lien.
 */

import { Plugin } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

export const linkBoundaryPlugin = $prose(
  () =>
    new Plugin({
      appendTransaction(trs, _oldState, newState) {
        if (!trs.some((tr) => tr.selectionSet || tr.docChanged)) return null;
        const sel = newState.selection;
        if (!sel.empty) return null;
        const linkType = newState.schema.marks.link;
        if (!linkType) return null;

        const $pos = sel.$from;
        const cursorMarks = newState.storedMarks ?? $pos.marks();
        if (!linkType.isInSet(cursorMarks)) return null;
        // Le caractère suivant porte encore le lien → caret à l'intérieur, on ne
        // touche à rien. Sinon, on est à la frontière droite → on sort du lien.
        const after = $pos.nodeAfter;
        if (after && linkType.isInSet(after.marks)) return null;

        return newState.tr.setStoredMarks(
          cursorMarks.filter((m) => m.type !== linkType)
        );
      },
    })
);
