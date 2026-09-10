/**
 * Logique pure de diff/propagation de template — extraite de useTemplateSync.ts
 * pour rester testable sans dépendances Tauri/Jotai (cf. templateConstraints.ts).
 */
import {
  diffEnumOptions,
  isEnumFormula,
  parseEnum,
} from "../../../shared/lib/FrontmatterPicker/enumProperty";
import {
  isFormatOnlyNumber,
  isNumberFormula,
  parseNumber,
  serializeNumber,
} from "../../../shared/lib/FrontmatterPicker/numberProperty";
import type { Frontmatter } from "../../../shared/lib/fileTreeHelpers";
import { isSystemField } from "../../../shared/lib/fileTreeHelpers";

export type TemplateChange =
  | { type: "addProp"; key: string; value?: string }
  | { type: "removeProp"; key: string }
  // template_value : valeur du template pour new_key — détermine si la prop est imposée ou libre
  | {
      type: "renameProp";
      old_key: string;
      new_key: string;
      template_value?: string;
    }
  | { type: "forceValue"; key: string; value: string }
  // NUMBER format seul (expr vide dans le template) : ne patche que
  // decimals/unit chez les héritiers, préserve leur propre expr — analogue à
  // enforceEnum pour ENUM, jamais une valeur imposée en bloc.
  | { type: "forceNumberFormat"; key: string; decimals?: number; unit?: string }
  // Renommage d'une valeur permise dans un ENUM → maj des héritiers qui l'avaient choisie
  | {
      type: "renameEnumValue";
      key: string;
      old_value: string;
      new_value: string;
    }
  // Réconciliation ENUM : écrase par le default toute valeur non permise
  | {
      type: "enforceEnum";
      key: string;
      options: string[];
      default: string;
    };

/**
 * Résolution de conflit lors du renommage d'une propriété template.
 * Si new_key existe déjà dans la note :
 *   - prop imposée (templateValue non vide) → la valeur du template prime
 *   - prop libre (templateValue vide) → la valeur existante de la note est conservée
 * Si pas de conflit : renommage simple (valeur de old_key préservée).
 */
export function applyRenameConflict(
  fm: Frontmatter,
  oldKey: string,
  newKey: string,
  templateValue: string | undefined
): Frontmatter {
  const withoutOld = Object.fromEntries(
    Object.entries(fm).filter(([k]) => k !== oldKey)
  ) as Frontmatter;

  if (newKey in fm) {
    // Conflit : new_key existe déjà
    const imposed = !!templateValue;
    if (imposed) {
      // Propriété imposée : la valeur du template prime
      return { ...withoutOld, [newKey]: templateValue! };
    }
    // Propriété contraignante : old_key avait une valeur → elle prime ; sinon adopter new_key
    const oldVal = fm[oldKey];
    const oldIsEmpty = !oldVal || oldVal === "";
    if (!oldIsEmpty) {
      return { ...withoutOld, [newKey]: oldVal };
    }
    return withoutOld; // old_key vide → new_key conserve sa valeur
  }

  // Pas de conflit : renommage simple, préserver la valeur de old_key
  return { ...withoutOld, [newKey]: fm[oldKey] };
}

/**
 * Une valeur de template qui contraint (ENUM, NUMBER format seul) plutôt
 * que d'imposer une valeur littérale — cf. useTemplateConstraints.
 */
function isConstraintOnlyValue(value: string): boolean {
  if (isEnumFormula(value)) return true;
  if (!isNumberFormula(value)) return false;
  const def = parseNumber(value);
  return !!def && isFormatOnlyNumber(def);
}

export function diffFrontmatter(
  prev: Frontmatter,
  next: Frontmatter
): TemplateChange[] {
  const changes: TemplateChange[] = [];

  const prevKeys = Object.keys(prev).filter((k) => !isSystemField(k));
  const nextKeys = Object.keys(next).filter((k) => !isSystemField(k));

  const added = nextKeys.filter((k) => !(k in prev));
  const removed = prevKeys.filter((k) => !(k in next));

  if (added.length === 1 && removed.length === 1) {
    const newVal = next[added[0]] as string | undefined;
    changes.push({
      type: "renameProp",
      old_key: removed[0],
      new_key: added[0],
      // ENUM / NUMBER format seul : traités comme contrainte (template_value
      // vide) → préserve la valeur de l'héritier
      template_value: newVal && isConstraintOnlyValue(newVal) ? "" : newVal,
    });
    return changes;
  }

  for (const key of added) {
    const v = next[key] as string | undefined;
    const enumDef = v && isEnumFormula(v) ? parseEnum(v) : null;
    const numberDef =
      v && !enumDef && isNumberFormula(v) ? parseNumber(v) : null;
    if (enumDef) {
      // ENUM : l'héritier reçoit le default (jamais la formule)
      changes.push({ type: "addProp", key, value: enumDef.default });
    } else if (numberDef && isFormatOnlyNumber(numberDef)) {
      // NUMBER format seul : l'héritier reçoit un littéral amorcé à 0, avec
      // le format imposé (jamais la formule vide elle-même)
      changes.push({
        type: "addProp",
        key,
        value: serializeNumber({
          expr: "0",
          decimals: numberDef.decimals,
          unit: numberDef.unit,
        }),
      });
    } else {
      changes.push({ type: "addProp", key, value: v });
    }
  }
  for (const key of removed) {
    changes.push({ type: "removeProp", key });
  }

  for (const key of nextKeys) {
    if (!(key in prev) || prev[key] === next[key]) continue;
    const prevVal = prev[key];
    const nextVal = next[key];

    // Propriété ENUM : pas de forceValue (contrainte, pas valeur imposée).
    // Un renommage d'option se propage aux héritiers qui l'avaient choisie.
    // (defs parsées via ternaire pour ne pas rétrécir le type de nextVal après continue)
    const nextDef =
      typeof nextVal === "string" && isEnumFormula(nextVal)
        ? parseEnum(nextVal)
        : null;
    if (nextDef) {
      const prevDef =
        typeof prevVal === "string" && isEnumFormula(prevVal)
          ? parseEnum(prevVal)
          : null;
      if (prevDef) {
        const optionsDiff = diffEnumOptions(prevDef, nextDef);
        for (const r of optionsDiff.renames) {
          changes.push({
            type: "renameEnumValue",
            key,
            old_value: r.old,
            new_value: r.new,
          });
        }
        // Options retirées → les héritiers qui les avaient deviennent invalides : reset au default
        if (optionsDiff.removed.length > 0) {
          changes.push({
            type: "enforceEnum",
            key,
            options: nextDef.options.map((o) => o.value),
            default: nextDef.default,
          });
        }
      }
      continue;
    }

    // NUMBER format seul : pas de forceValue (contrainte de format, pas
    // valeur imposée) — ne patche que decimals/unit, préserve l'expr de
    // chaque héritier (cf. forceNumberFormat dans propagate()).
    const nextNumberDef =
      typeof nextVal === "string" && isNumberFormula(nextVal)
        ? parseNumber(nextVal)
        : null;
    if (nextNumberDef && isFormatOnlyNumber(nextNumberDef)) {
      changes.push({
        type: "forceNumberFormat",
        key,
        decimals: nextNumberDef.decimals,
        unit: nextNumberDef.unit,
      });
      continue;
    }

    if (typeof nextVal === "string" && nextVal) {
      changes.push({ type: "forceValue", key, value: nextVal });
    }
  }

  return changes;
}
