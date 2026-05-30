import type { Frontmatter, NoteFile } from "../../../../shared/hooks/useFileTree";
import { isSystemField } from "../../../../shared/lib/fileTreeHelpers";
import { SystemField, getFieldDef } from "../../../../shared/lib/noteTypes";

export interface Row {
  key: string;
  value: string | string[];
  isSystem: boolean;
  isNoteArray: boolean;
}

// ── Helpers partagés (FrontmatterValue, TableCell) ─────────────────────────

export interface PropertyOption {
  key: string;
  displayName: string;
}

/** Regex de trigger pour l'auto-complétion des propriétés de note dans les formules. */
export const REF_PROP_TRIGGER_RE = /ref\("([^"]+)"\)\.$/;

/** Liste des propriétés visibles d'une note (hors __Type__ et __Children__). */
export function getNoteProperties(note: NoteFile): PropertyOption[] {
  return Object.keys(note.frontmatter)
    .filter((k) => k !== SystemField.TYPE && k !== SystemField.CHILDREN)
    .map((key) => ({ key, displayName: key.replace(/^__|__$/g, "") }));
}

// ── Conversion frontmatter ↔ rows ─────────────────────────────────────────

export function toRows(frontmatter: Frontmatter): Row[] {
  return Object.entries(frontmatter).map(([key, value]) => {
    const def = getFieldDef(key);
    const isNoteArray = def?.kind === "noteArray";
    return {
      key,
      value: isNoteArray
        ? Array.isArray(value)
          ? value
          : value
            ? [value as string]
            : []
        : Array.isArray(value)
          ? value.join(", ")
          : String(value ?? ""),
      isSystem: isSystemField(key),
      isNoteArray,
    };
  });
}

// A13 : pas d'heuristique virgule — row.isNoteArray est la source de vérité.
export function toFrontmatter(rows: Row[]): Frontmatter {
  const result: Frontmatter = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    if (row.isNoteArray) {
      result[row.key] = row.value as string[];
    } else {
      result[row.key] = row.value as string;
    }
  }
  return result;
}
