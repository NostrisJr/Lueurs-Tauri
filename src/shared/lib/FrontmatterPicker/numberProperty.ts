// ── Propriété "Nombre" ───────────────────────────────────────────────────────
//
// Syntaxe : $$NUMBER(<expr>, decimals=2, unit="km")$$
// - <expr> : littéral (ex. "42") ou expression du même langage que les
//   formules ($$...$$) — self[], ref(), round(), iif(), agg().
// - decimals, unit : optionnels, dans cet ordre fixe (comme les arguments de
//   ENUM — pas de parsing par nom de clé arbitraire).
//
// Distinction "valeur éditable" / "calculé" : pas un flag stocké, déduite de
// la forme de <expr> — un littéral numérique reste éditable au clavier
// (comme une propriété texte normale), toute autre expression est affichée
// en lecture seule et recalculée (comme une formule classique).
//
// <expr> peut être vide si decimals/unit est défini : dans un template, ça
// exprime une contrainte de FORMAT seule (analogue aux options d'un ENUM),
// sans valeur imposée — cf. isFormatOnlyNumber et useTemplateConstraints.
// $$NUMBER()$$ (rien du tout) reste invalide : il n'y a alors rien à contraindre.

const NUMBER_RE = /^\$\$\s*NUMBER\s*\(([\s\S]*)\)\s*\$\$$/;
const UNIT_TAIL_RE = /,\s*unit\s*=\s*"([^"]*)"\s*$/;
const DECIMALS_TAIL_RE = /,\s*decimals\s*=\s*(\d+)\s*$/;
const PLAIN_NUMBER_RE = /^-?\d+(\.\d+)?$/;

export interface NumberDef {
  expr: string;
  decimals?: number;
  unit?: string;
}

export function isNumberFormula(value: unknown): value is string {
  return typeof value === "string" && NUMBER_RE.test(value.trim());
}

/** Parse `$$NUMBER(expr, decimals=2, unit="km")$$` → { expr, decimals?, unit? }. null si invalide. */
export function parseNumber(value: string): NumberDef | null {
  const m = NUMBER_RE.exec(value.trim());
  if (!m) return null;

  let rest = m[1];

  let unit: string | undefined;
  const unitMatch = UNIT_TAIL_RE.exec(rest);
  if (unitMatch) {
    unit = unitMatch[1];
    rest = rest.slice(0, unitMatch.index);
  }

  let decimals: number | undefined;
  const decimalsMatch = DECIMALS_TAIL_RE.exec(rest);
  if (decimalsMatch) {
    decimals = Number(decimalsMatch[1]);
    rest = rest.slice(0, decimalsMatch.index);
  }

  const expr = rest.trim();
  // expr vide n'est valide que s'il reste un format à contraindre — sinon
  // il n'y a rien de significatif dans cette formule.
  if (!expr && decimals === undefined && !unit) return null;

  return { expr, decimals, unit };
}

export function serializeNumber(def: NumberDef): string {
  let inner = def.expr;
  if (def.decimals !== undefined) inner += `, decimals=${def.decimals}`;
  if (def.unit) inner += `, unit="${def.unit}"`;
  return `$$NUMBER(${inner})$$`;
}

/** L'expression est un littéral numérique simple : éditable directement, pas une formule. */
export function isPlainNumberExpr(expr: string): boolean {
  return PLAIN_NUMBER_RE.test(expr.trim());
}

/**
 * Contrainte de format seule (expr vide, decimals/unit défini) : dans un
 * template, la clé est verrouillée mais pas la valeur — l'héritier choisit
 * librement son nombre, decimals/unit lui sont imposés. Analogue au couple
 * options(imposées)/default(libre) de ENUM.
 */
export function isFormatOnlyNumber(def: NumberDef): boolean {
  return def.expr.trim() === "" && (def.decimals !== undefined || !!def.unit);
}

/**
 * Réconcilie le format (decimals/unit) d'une valeur NUMBER existante avec une
 * contrainte de format imposée par un template, en préservant l'expr actuel
 * (formule ou littéral) — ou en l'amorçant à "0" si la valeur n'est pas encore
 * un NUMBER valide (prop absente, texte libre...). Utilisé au chargement d'une
 * note (computeTemplateProps) et lors de la propagation d'un changement de
 * template (useTemplateSync) — jamais le prev/nextValue brut n'est copié tel
 * quel, contrairement à une valeur pleinement imposée.
 */
export function reconcileNumberFormat(
  currentValue: string,
  format: Pick<NumberDef, "decimals" | "unit">
): string {
  const curDef = isNumberFormula(currentValue)
    ? parseNumber(currentValue)
    : null;
  const expr = curDef
    ? curDef.expr
    : isPlainNumberExpr(currentValue)
      ? currentValue
      : "0";
  return serializeNumber({
    expr,
    decimals: format.decimals,
    unit: format.unit,
  });
}

/**
 * Fusionne une contrainte de format (decimals/unit imposés par un template)
 * dans un NumberDef en édition, en préservant toujours l'expr — utilisé côté
 * UI (useValueEditor) pour que decimals/unit restent visuellement et
 * effectivement figés sur les valeurs du template, quel que soit ce que
 * l'héritier avait localement.
 */
export function applyFormatConstraint(
  def: NumberDef,
  constraint: Pick<NumberDef, "decimals" | "unit">
): NumberDef {
  return {
    expr: def.expr,
    decimals: constraint.decimals,
    unit: constraint.unit,
  };
}

/** Applique decimals + unit à un résultat déjà calculé (chaîne numérique ou non). */
export function formatNumberResult(
  result: string,
  def: Pick<NumberDef, "decimals" | "unit">
): string {
  const num = Number(result);
  if (result.trim() === "" || Number.isNaN(num)) return result;
  const formatted =
    def.decimals !== undefined ? num.toFixed(def.decimals) : String(num);
  return def.unit ? `${formatted} ${def.unit}` : formatted;
}
