/**
 * rewriteOpenFormulas.ts
 *
 * Réécriture en masse des formules inline du document OUVERT.
 *
 * Le corps de la note active ne peut pas être patché sur disque : Milkdown est
 * initialisé une seule fois avec `node.body` (cf. MarkdownEditor) et ne se
 * resynchronise pas sur un changement externe — l'écriture serait écrasée à la
 * frappe suivante. On passe donc par une transaction, et le pipeline normal
 * (markdownUpdated → onChange → updateNote) fait le reste.
 */

import { editorViewCtx } from "@milkdown/kit/core";
import { activeEditorRef } from "../../components/NoteEditor/lib/activeEditorRef";
import { createLogger } from "../../lib/logger";

const log = createLogger("rewriteOpenFormulas");

/** Applique `rewrite` à l'attribut `raw` de chaque formule inline du doc ouvert. */
export function rewriteOpenEditorFormulas(
  rewrite: (raw: string) => string
): boolean {
  const editor = activeEditorRef.current;
  if (!editor) return false;

  let count = 0;
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const tr = view.state.tr;
    // setNodeAttribute ne décale aucune position : les pos du doc d'origine
    // restent valides d'un bout à l'autre de l'accumulation.
    view.state.doc.descendants((node, pos) => {
      if (node.type.name !== "inline_formula") return;
      const raw = node.attrs.raw as string;
      const next = rewrite(raw);
      if (next !== raw) {
        tr.setNodeAttribute(pos, "raw", next);
        count++;
      }
    });
    if (count > 0) view.dispatch(tr);
  });

  if (count > 0)
    log.info("formules inline réécrites dans l'éditeur", { count });
  return count > 0;
}
