// Rendu propre du document ProseMirror courant.
// Réutilisé par l'indicateur pages/mots (mesure) et l'export PDF (génération HTML).
// DOMSerializer produit la sortie canonique toDOM du schéma — sans les widgets
// d'édition (caret custom, marqueurs de fold, node-views interactifs).

import { type Editor, editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { DOMSerializer } from "@milkdown/kit/prose/model";

/** HTML propre du contenu de la note (marks/nodes custom inclus, sans chrome d'édition). */
export function getCleanContentHTML(editor: Editor | null): string {
  if (!editor) return "";
  let html = "";
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const schema = ctx.get(schemaCtx);
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      view.state.doc.content,
      { document }
    );
    const container = document.createElement("div");
    container.appendChild(fragment);
    html = container.innerHTML;
  });
  return html;
}

/** Texte brut du document (sans syntaxe markdown), pour le comptage de mots. */
export function getPlainText(editor: Editor | null): string {
  if (!editor) return "";
  let text = "";
  editor.action((ctx) => {
    const doc = ctx.get(editorViewCtx).state.doc;
    text = doc.textBetween(0, doc.content.size, "\n", " ");
  });
  return text;
}
