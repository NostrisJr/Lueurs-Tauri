/**
 * input-rule.ts — frappe de `$$` → insère un nœud formule vide et ouvre le popup.
 *
 * Deux plugins coordonnés :
 *  - input rule : remplace `$$` par un nœud `inline_formula` vide (raw `$$$$`).
 *  - auto-open  : au prochain `view.update` (après dispatch de la règle), ouvre le
 *    popup d'édition sur le nœud fraîchement inséré. On passe par cette étape car
 *    le handler d'input rule n'a pas accès à la vue (coordonnées écran).
 */

import { InputRule, inputRules } from "@milkdown/kit/prose/inputrules";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { setInlineFormulaEdit } from "./inlineFormulaState";

// Position d'un nœud à ouvrir au prochain update (posé par l'input rule).
let pendingOpenPos: number | null = null;

export const inlineFormulaInputRule = $prose(() =>
  inputRules({
    rules: [
      new InputRule(/\$\$$/, (state, _match, start, end) => {
        const type = state.schema.nodes.inline_formula;
        if (!type) return null;
        // Pas dans un bloc de code
        if (state.doc.resolve(start).parent.type.spec.code) return null;
        pendingOpenPos = start;
        return state.tr.replaceRangeWith(start, end, type.create());
      }),
    ],
  })
);

export const inlineFormulaAutoOpenPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey("inline-formula-autoopen"),
      view: (view) => ({
        update() {
          if (pendingOpenPos === null) return;
          const pos = pendingOpenPos;
          pendingOpenPos = null;
          const node = view.state.doc.nodeAt(pos);
          if (node?.type.name !== "inline_formula") return;
          const coords = view.coordsAtPos(pos);
          setInlineFormulaEdit({
            pos,
            raw: node.attrs.raw as string,
            coords: {
              left: coords.left,
              top: coords.top,
              bottom: coords.bottom,
            },
          });
        },
      }),
    })
);
