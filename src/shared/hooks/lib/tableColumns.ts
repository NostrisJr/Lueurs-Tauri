import type { EnumDef } from "../../lib/FrontmatterPicker/enumProperty";
import type { NumberDef } from "../../lib/FrontmatterPicker/numberProperty";
import { computeTemplateConstraints } from "../../lib/FrontmatterPicker/templateConstraints";
import { isSystemField } from "../../lib/fileTreeHelpers";
import type { Frontmatter } from "../useFileTree";

export const DEFAULT_COL_WIDTH = 180;

export interface TableColumn {
  key: string;
  width: number;
  // Propriété contraignante (valeur libre dans le template) vs imposée (valeur forcée)
  isImposed: boolean;
  // Contrainte ENUM : valeur choisie via dropdown parmi des options
  enumConstraint?: EnumDef;
  // Contrainte NUMBER format seul (decimals/unit imposés, expr libre)
  numberFormatConstraint?: NumberDef;
  // Templates qui définissent cette propriété — pour le renommage
  templatePaths: string[];
}

export interface TableTemplateInput {
  id: string;
  frontmatter: Frontmatter;
}

/**
 * Dérive les colonnes d'une base depuis ses templates : union de toutes les
 * props non-système (premier template gagne pour l'ordre), avec les
 * contraintes ENUM/NUMBER calculées via computeTemplateConstraints — logique
 * de contrainte partagée avec le panneau frontmatter (cf. useTemplateConstraints),
 * pas dupliquée ici.
 */
export function computeTableColumns(
  templates: TableTemplateInput[],
  savedWidths: Record<string, number>
): TableColumn[] {
  const constraints = computeTemplateConstraints(
    templates.map((t) => t.frontmatter)
  );

  const seenKeys = new Set<string>();
  const columns: TableColumn[] = [];

  for (const template of templates) {
    for (const key of Object.keys(template.frontmatter)) {
      if (isSystemField(key)) continue;
      if (seenKeys.has(key)) {
        const col = columns.find((c) => c.key === key);
        if (col && !col.templatePaths.includes(template.id)) {
          col.templatePaths.push(template.id);
        }
        continue;
      }
      seenKeys.add(key);
      columns.push({
        key,
        isImposed: constraints.lockedValues.has(key),
        enumConstraint: constraints.enumConstraints.get(key),
        numberFormatConstraint: constraints.numberFormatConstraints.get(key),
        width: savedWidths[key] ?? DEFAULT_COL_WIDTH,
        templatePaths: [template.id],
      });
    }
  }

  return columns;
}
