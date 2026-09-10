import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { activeNoteAtom, notesByIdAtom } from "../../shared/lib/atoms";
import { toArray } from "../../shared/lib/fileTreeHelpers";
import { NoteType } from "../../shared/lib/noteTypes";
import {
  type TemplateConstraints,
  computeTemplateConstraints,
  emptyTemplateConstraints,
} from "../../shared/lib/FrontmatterPicker/templateConstraints";

export type { TemplateConstraints };

/**
 * Calcule les contraintes template pour la note active.
 * - lockedKeys  : toute prop héritée d'un template (clé verrouillée)
 * - lockedValues : props dont le template impose une valeur non vide (valeur verrouillée)
 * Les bases ne sont jamais contraintes. Logique pure dans lib/templateConstraints.ts.
 */
export function useTemplateConstraints(): TemplateConstraints {
  const activeNote = useAtomValue(activeNoteAtom);
  const notesById = useAtomValue(notesByIdAtom);

  return useMemo(() => {
    if (!activeNote || activeNote.type === NoteType.BASE)
      return emptyTemplateConstraints();

    const fm = activeNote.frontmatter;
    const directTemplates = toArray(fm.__Template__);
    const inheritedTemplates = toArray(fm.__Base__).flatMap((basePath) => {
      const base = notesById.get(basePath);
      return base ? toArray(base.frontmatter.__Template__) : [];
    });

    const templates = [...new Set([...directTemplates, ...inheritedTemplates])]
      .map((path) => notesById.get(path)?.frontmatter)
      .filter((fm): fm is NonNullable<typeof fm> => !!fm);

    return computeTemplateConstraints(templates);
  }, [activeNote, notesById]);
}
