// Conversion markdown → document ProseMirror via le parser de l'éditeur actif.
// Réutilise le même schema (plugins custom inclus) sans créer d'instance supplémentaire.

import { parserCtx } from "@milkdown/kit/core";
import type { Node } from "@milkdown/kit/prose/model";
import { activeEditorRef } from "../components/NoteEditor/lib/activeEditorRef";

/** Retourne null si aucun éditeur n'est monté ou si le parsing échoue. */
export function parseMarkdownToDoc(markdown: string): Node | null {
  const editor = activeEditorRef.current;
  if (!editor) return null;
  let doc: Node | null = null;
  editor.action((ctx) => {
    const parse = ctx.get(parserCtx);
    try {
      doc = parse(markdown);
    } catch {
      doc = null;
    }
  });
  return doc;
}
