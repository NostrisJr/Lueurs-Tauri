import { atom } from "jotai";
import { activeNoteAtom } from "../../../lib/atoms";
import { type Row, toRows, toFrontmatter } from "./frontmatterUtils";

// Champs modifiables uniquement par le système (jamais par l'utilisateur en direct)
const SYSTEM_FIELDS = ["__Children__", "__Base__", "__Template__", "__Type__"];

// Override local pendant l'édition — invalidé si la note change ou si un champ système dérive
const rowsOverrideAtom = atom<{ noteId: string; rows: Row[] } | null>(null);

export const rowsAtom = atom(
    (get) => {
        const note = get(activeNoteAtom);
        if (!note) return [];
        const override = get(rowsOverrideAtom);
        if (override?.noteId !== note.id) return toRows(note.frontmatter);

        // Si un champ système a été modifié en dehors d'un commit (ex: enfant supprimé),
        // l'override est périmé — on repart du frontmatter frais
        const overrideFm = toFrontmatter(override.rows);
        const systemDrifted = SYSTEM_FIELDS.some(
            (k) => JSON.stringify(overrideFm[k]) !== JSON.stringify(note.frontmatter[k])
        );
        if (systemDrifted) return toRows(note.frontmatter);

        return override.rows;
    },
    (get, set, rows: Row[]) => {
        const note = get(activeNoteAtom);
        if (!note) return;
        set(rowsOverrideAtom, { noteId: note.id, rows });
    }
);

export const editingKeyAtom = atom<string | null>(null);
export const selectorOpenAtom = atom<string | null>(null);