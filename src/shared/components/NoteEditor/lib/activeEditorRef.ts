// Ref module-level vers l'instance Milkdown de la note active (desktop).
// Peuplée à chaque montage de MarkdownEditor, comme dropHandlerRef.
// Consommée par useDocStats (indicateur pages/mots) et l'export PDF, qui ont
// besoin du document ProseMirror courant sans passer par le React tree.

import type { Editor } from "@milkdown/kit/core";

export const activeEditorRef: { current: Editor | null } = {
  current: null,
};
