import { atom } from "jotai";
import { activeNoteAtom } from "../../../../shared/lib/atoms";
import { frontmatterFieldEqual } from "../../../../shared/lib/fileTreeHelpers";
import { SYSTEM_FIELDS as SYSTEM_FIELD_DEFS } from "../../../../shared/lib/noteTypes";
import { type Row, toFrontmatter, toRows } from "./frontmatterUtils";

const SYSTEM_FIELDS = SYSTEM_FIELD_DEFS.map((f) => f.key);
const SYSTEM_FIELDS_SET: Set<string> = new Set(SYSTEM_FIELDS);

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
      (k) => !frontmatterFieldEqual(overrideFm[k], note.frontmatter[k])
    );
    if (systemDrifted) return toRows(note.frontmatter);

    // Dérive sur les clés : prop ajoutée par applyTemplateProps
    const noteKeys = Object.keys(note.frontmatter);
    const overrideKeys = new Set(Object.keys(overrideFm));
    const keysDrifted = noteKeys.some((k) => !overrideKeys.has(k));
    if (keysDrifted) return toRows(note.frontmatter);

    // Dérive sur les valeurs : prop écrasée par applyTemplateProps (valeur forcée)
    const valuesDrifted = noteKeys.some(
      (k) =>
        !SYSTEM_FIELDS_SET.has(k) &&
        overrideFm[k] !== undefined &&
        !frontmatterFieldEqual(overrideFm[k], note.frontmatter[k])
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
