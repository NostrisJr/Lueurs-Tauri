/**
 * suggest-plugin.ts
 *
 * Détecte deux déclencheurs avant le curseur et publie l'état dans
 * wikilinkSuggestState :
 *  - `[[query`        — wikilink classique ;
 *  - `[alias](query`  — cible d'un lien markdown en cours de frappe (puisque
 *    c'est la forme réellement encodée).
 * Le popup React (WikilinkSuggest) affiche les notes correspondantes et insère
 * un lien markdown standard `[nom](chemin.md)` (mark `link`) à la place du
 * déclencheur.
 */

import type { EditorState } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { setWikilinkSuggest } from "./wikilinkSuggestState";

// Caractère de remplacement pour les nœuds atomiques (taille 1) : garde
// l'alignement entre l'offset texte et les positions du document.
const LEAF = "￼";

interface SuggestPluginState {
  active: boolean;
  from: number;
  to: number;
  query: string;
  /** Alias déjà saisi pour un déclencheur `[alias](…` ; sinon undefined. */
  alias?: string;
}

const INACTIVE: SuggestPluginState = {
  active: false,
  from: 0,
  to: 0,
  query: "",
};

const wikilinkSuggestKey = new PluginKey<SuggestPluginState>(
  "wikilink-suggest"
);

function compute(state: EditorState): SuggestPluginState {
  const sel = state.selection;
  if (!sel.empty) return INACTIVE;
  const { $from } = sel;
  // Pas de suggestion dans un bloc de code
  if ($from.parent.type.spec.code) return INACTIVE;

  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, LEAF);

  // 1) Déclencheur markdown `[alias](query` — curseur dans la cible, `)` non fermé
  const md = text.match(/\[([^[\]]*)\]\(([^)\n]*)$/);
  if (md && !md[2].includes(LEAF)) {
    return {
      active: true,
      from: $from.start() + (md.index ?? 0),
      to: $from.pos,
      query: md[2],
      alias: md[1],
    };
  }

  // 2) Déclencheur wikilink `[[query`
  const idx = text.lastIndexOf("[[");
  if (idx === -1) return INACTIVE;

  const query = text.slice(idx + 2);
  // Requête invalide : crochet fermant amorcé, nouveau `[`, ou nœud atomique
  if (query.includes("]") || query.includes("[") || query.includes(LEAF)) {
    return INACTIVE;
  }

  return {
    active: true,
    from: $from.start() + idx,
    to: $from.pos,
    query,
  };
}

export const wikilinkSuggestPlugin = $prose(
  () =>
    new Plugin<SuggestPluginState>({
      key: wikilinkSuggestKey,
      state: {
        init: () => INACTIVE,
        apply: (_tr, _value, _old, newState) => compute(newState),
      },
      view: (view) => {
        function sync() {
          const s = wikilinkSuggestKey.getState(view.state);
          if (s?.active) {
            const coords = view.coordsAtPos(s.from);
            setWikilinkSuggest({
              from: s.from,
              to: s.to,
              query: s.query,
              alias: s.alias,
              coords: {
                left: coords.left,
                top: coords.top,
                bottom: coords.bottom,
              },
            });
          } else {
            setWikilinkSuggest(null);
          }
        }
        sync();
        return {
          update: sync,
          destroy: () => setWikilinkSuggest(null),
        };
      },
    })
);
