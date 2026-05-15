import type { Frontmatter } from "../../../../shared/hooks/useFileTree";
import { isSystemField } from "../../../../shared/lib/fileTreeHelpers";
import { getFieldDef } from "../../../../shared/lib/noteTypes";

export interface Row {
  key: string;
  value: string | string[];
  isSystem: boolean;
  isNoteArray: boolean;
}

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

export function toFrontmatter(rows: Row[]): Frontmatter {
  const result: Frontmatter = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    if (row.isNoteArray) {
      result[row.key] = row.value as string[];
    } else {
      const v = row.value as string;
      result[row.key] = v.includes(",")
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : v;
    }
  }
  return result;
}
