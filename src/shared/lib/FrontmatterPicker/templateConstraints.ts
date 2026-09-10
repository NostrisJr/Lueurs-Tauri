import type { Frontmatter } from "../../hooks/useFileTree";
import { isSystemField } from "../fileTreeHelpers";
import { type EnumDef, isEnumFormula, parseEnum } from "./enumProperty";
import {
  type NumberDef,
  isFormatOnlyNumber,
  isNumberFormula,
  parseNumber,
} from "./numberProperty";

export interface TemplateConstraints {
  /** Clés provenant d'un template — non renommables, non supprimables. */
  lockedKeys: Set<string>;
  /** Clés dont la valeur est imposée par un template — input désactivé. */
  lockedValues: Set<string>;
  /** Clés contraintes par un ENUM — valeur choisie via dropdown. */
  enumConstraints: Map<string, EnumDef>;
  /**
   * Clés contraintes par un NUMBER format seul (expr vide, decimals/unit
   * défini dans le template) : decimals/unit imposés, valeur libre — analogue
   * à enumConstraints pour ENUM.
   */
  numberFormatConstraints: Map<string, NumberDef>;
}

export function emptyTemplateConstraints(): TemplateConstraints {
  return {
    lockedKeys: new Set<string>(),
    lockedValues: new Set<string>(),
    enumConstraints: new Map<string, EnumDef>(),
    numberFormatConstraints: new Map<string, NumberDef>(),
  };
}

/**
 * Calcule les contraintes imposées par une liste de templates (pur, sans
 * dépendance React/Jotai — cf. useTemplateConstraints pour la résolution des
 * templates de la note active).
 */
export function computeTemplateConstraints(
  templates: Frontmatter[]
): TemplateConstraints {
  const result = emptyTemplateConstraints();

  for (const template of templates) {
    for (const [key, value] of Object.entries(template)) {
      if (isSystemField(key)) continue;
      result.lockedKeys.add(key);

      // ENUM : contrainte de valeurs, pas une valeur imposée (dropdown éditable)
      // def calculé via ternaire pour ne pas rétrécir le type de `value`
      const enumDef =
        typeof value === "string" && isEnumFormula(value)
          ? parseEnum(value)
          : null;
      if (enumDef) {
        result.enumConstraints.set(key, enumDef);
        continue;
      }

      // NUMBER format seul : contrainte de format, pas une valeur imposée
      // (expr libre, decimals/unit imposés — dropdown numérique équivalent)
      const numberDef =
        typeof value === "string" && isNumberFormula(value)
          ? parseNumber(value)
          : null;
      if (numberDef && isFormatOnlyNumber(numberDef)) {
        result.numberFormatConstraints.set(key, numberDef);
        continue;
      }

      if (value !== "" && value !== null && value !== undefined) {
        result.lockedValues.add(key);
      }
    }
  }

  return result;
}
