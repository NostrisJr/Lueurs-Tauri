/**
 * wikilinkBridge.ts
 *
 * Pont module-level entre la NodeView wikilink (hors React) et l'app React.
 * MarkdownEditor met à jour `wikilinkBridge.current` à chaque changement de
 * vault / arbre de notes ; la NodeView le lit au moment du clic.
 * Même pattern que `dropHandlerRef` / `activeEditorRef`.
 */

export interface WikilinkBridge {
  /** target (chemin relatif au vault, avec extension) → id de note (absolu) ou null si introuvable. */
  resolve: (target: string) => string | null;
  /** Ouvre la note ciblée. newTab = Cmd/Ctrl+clic sur desktop. */
  open: (noteId: string, newTab: boolean) => void;
}

export const wikilinkBridge: { current: WikilinkBridge | null } = {
  current: null,
};

/** Libellé affiché : dernier segment du target sans extension `.md`. */
export function labelFromTarget(target: string): string {
  const segment = target.split("/").pop() ?? target;
  return segment.replace(/\.md$/i, "");
}
