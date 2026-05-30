import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { activeNoteAtom, notesByIdAtom } from "../../shared/lib/atoms";
import {
  type ButtonDef,
  isButtonFormula,
  parseButton,
} from "../../shared/lib/FrontmatterPicker/buttonProperty";
import { isSystemField, toArray } from "../../shared/lib/fileTreeHelpers";
import { NoteType } from "../../shared/lib/noteTypes";

export interface TemplateConstraints {
  /** Clés provenant d'un template — non renommables, non supprimables. */
  lockedKeys: Set<string>;
  /** Clés dont la valeur est imposée par un template — input désactivé. */
  lockedValues: Set<string>;
  /** Clés contraintes par un BUTTON — valeur choisie via dropdown. */
  enumConstraints: Map<string, ButtonDef>;
}

/**
 * Calcule les contraintes template pour la note active.
 * - lockedKeys  : toute prop héritée d'un template (clé verrouillée)
 * - lockedValues : props dont le template impose une valeur non vide (valeur verrouillée)
 * Les bases ne sont jamais contraintes.
 */
export function useTemplateConstraints(): TemplateConstraints {
  const activeNote = useAtomValue(activeNoteAtom);
  const notesById = useAtomValue(notesByIdAtom);

  return useMemo(() => {
    const empty = {
      lockedKeys: new Set<string>(),
      lockedValues: new Set<string>(),
      enumConstraints: new Map<string, ButtonDef>(),
    };
    if (!activeNote || activeNote.type === NoteType.BASE) return empty;

    const fm = activeNote.frontmatter;
    const directTemplates = toArray(fm.__Template__);
    const inheritedTemplates = toArray(fm.__Base__).flatMap((basePath) => {
      const base = notesById.get(basePath);
      return base ? toArray(base.frontmatter.__Template__) : [];
    });

    const lockedKeys = new Set<string>();
    const lockedValues = new Set<string>();
    const enumConstraints = new Map<string, ButtonDef>();

    for (const templatePath of [
      ...new Set([...directTemplates, ...inheritedTemplates]),
    ]) {
      const template = notesById.get(templatePath);
      if (!template) continue;
      for (const [key, value] of Object.entries(template.frontmatter)) {
        if (isSystemField(key)) continue;
        lockedKeys.add(key);
        // BUTTON : contrainte de valeurs, pas une valeur imposée (dropdown éditable)
        // def calculé via ternaire pour ne pas rétrécir le type de `value`
        const def =
          typeof value === "string" && isButtonFormula(value)
            ? parseButton(value)
            : null;
        if (def) {
          enumConstraints.set(key, def);
          continue;
        }
        if (value !== "" && value !== null && value !== undefined) {
          lockedValues.add(key);
        }
      }
    }

    return { lockedKeys, lockedValues, enumConstraints };
  }, [activeNote, notesById]);
}
