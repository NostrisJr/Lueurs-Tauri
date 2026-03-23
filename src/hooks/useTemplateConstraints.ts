import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { activeNoteAtom, treeAtom } from "../lib/atoms";
import { flattenTree } from "../components/FileTree/hooks/useFileTree";
import { NoteType } from "../lib/noteTypes";
import { isSystemField } from "../components/FileTree/lib/fileTreeHelpers";

function toArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as string[];
    return [value as string];
}

export interface TemplateConstraints {
    /** Clés provenant d'un template — non renommables, non supprimables. */
    lockedKeys: Set<string>;
    /** Clés dont la valeur est imposée par un template — input désactivé. */
    lockedValues: Set<string>;
}

/**
 * Calcule les contraintes template pour la note active.
 * - lockedKeys  : toute prop héritée d'un template (clé verrouillée)
 * - lockedValues : props dont le template impose une valeur non vide (valeur verrouillée)
 * Les bases ne sont jamais contraintes.
 */
export function useTemplateConstraints(): TemplateConstraints {
    const activeNote = useAtomValue(activeNoteAtom);
    const allNotes = flattenTree(useAtomValue(treeAtom));

    return useMemo(() => {
        const empty = { lockedKeys: new Set<string>(), lockedValues: new Set<string>() };
        if (!activeNote || activeNote.type === NoteType.BASE) return empty;

        const fm = activeNote.frontmatter;
        const directTemplates = toArray(fm.__Template__);
        const inheritedTemplates = toArray(fm.__Base__).flatMap((basePath) => {
            const base = allNotes.find((n) => n.id === basePath);
            return base ? toArray(base.frontmatter.__Template__) : [];
        });

        const lockedKeys = new Set<string>();
        const lockedValues = new Set<string>();

        for (const templatePath of [...new Set([...directTemplates, ...inheritedTemplates])]) {
            const template = allNotes.find((n) => n.id === templatePath);
            if (!template) continue;
            for (const [key, value] of Object.entries(template.frontmatter)) {
                if (isSystemField(key)) continue;
                lockedKeys.add(key);
                if (value !== "" && value !== null && value !== undefined) {
                    lockedValues.add(key);
                }
            }
        }

        return { lockedKeys, lockedValues };
    }, [activeNote, allNotes]);
}