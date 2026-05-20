import { atom } from "jotai";
import { activeNoteAtom } from "../../../../shared/lib/atoms";
import { type Row, toFrontmatter, toRows } from "./frontmatterUtils";

const SYSTEM_FIELDS = ["__Children__", "__Base__", "__Template__", "__Type__"];

const rowsOverrideAtom = atom<{ noteId: string; rows: Row[] } | null>(null);

export const rowsAtom = atom(
  (get) => {
    const note = get(activeNoteAtom);
    if (!note) return [];
    const override = get(rowsOverrideAtom);
    if (override?.noteId !== note.id) return toRows(note.frontmatter);

    const overrideFm = toFrontmatter(override.rows);

    // Dérive sur les champs système
    const systemDrifted = SYSTEM_FIELDS.some(
      (k) =>
        JSON.stringify(overrideFm[k]) !== JSON.stringify(note.frontmatter[k])
    );
    if (systemDrifted) return toRows(note.frontmatter);

    // Dérive sur les clés : prop ajoutée par applyTemplateProps
    const noteKeys = Object.keys(note.frontmatter);
    const overrideKeys = Object.keys(overrideFm);
    const keysDrifted = noteKeys.some((k) => !overrideKeys.includes(k));
    if (keysDrifted) return toRows(note.frontmatter);

    // Dérive sur les valeurs : prop écrasée par applyTemplateProps (valeur forcée)
    const valuesDrifted = noteKeys.some(
      (k) =>
        !SYSTEM_FIELDS.includes(k) &&
        overrideFm[k] !== undefined &&
        overrideFm[k] !== note.frontmatter[k]
    );
    if (valuesDrifted) return toRows(note.frontmatter);

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
