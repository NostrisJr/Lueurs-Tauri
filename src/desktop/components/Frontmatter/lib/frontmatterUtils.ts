import type {
  Frontmatter,
  NoteFile,
} from "../../../../shared/hooks/useFileTree";
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

/**
 * Trigger de l'auto-complétion des propriétés de note dans les formules
 * (`ref("…")[`) — le crochet ouvrant, pas le point : la forme insérée est
 * toujours `["prop"]`, donc ce qu'on tape correspond à ce qui apparaît.
 */
export const REF_PROP_TRIGGER_RE = /ref\("([^"]+)"\)\[$/;

/**
 * Trigger de l'auto-complétion des propriétés de la note courante (`self[`).
 * La borne gauche évite de matcher un identifiant qui se termine par « self »
 * (ex: `monself[`).
 */
export const SELF_PROP_TRIGGER_RE = /(?:^|[^\p{L}\p{N}_.])self\[$/u;

/**
 * Propriétés proposables à l'auto-complétion (hors __Type__ et __Children__).
 * `excludeKey` sert à `self.` : une propriété ne se référence pas elle-même.
 */
export function toPropertyOptions(
  keys: string[],
  excludeKey?: string
): PropertyOption[] {
  return keys
    .filter(
      (k) =>
        k !== SystemField.TYPE && k !== SystemField.CHILDREN && k !== excludeKey
    )
    .map((key) => ({ key, displayName: key.replace(/^__|__$/g, "") }));
}

/** Liste des propriétés visibles d'une note (hors __Type__ et __Children__). */
export function getNoteProperties(note: NoteFile): PropertyOption[] {
  return toPropertyOptions(Object.keys(note.frontmatter));
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
