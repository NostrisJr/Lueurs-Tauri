/**
 * inlineFormulaPlugin.ts — formules calculées inline dans le corps des notes.
 *
 * Même moteur que le frontmatter (`src/shared/lib/formulas.ts`) : `$$expr$$` avec
 * self.*, ref("chemin"), round/iif/agg. Stockage en chemins absolus, affichage du
 * nom seul (humanisation dans le popup d'édition). Trois niveaux d'affichage :
 *  - caret dehors        → `ƒ résultat` (NodeView, DOM impératif)
 *  - édition (popup)      → formule humanisée + sélecteurs note/propriété
 *  - sur disque           → `$$expr$$` avec chemins absolus
 */

import { $view } from "@milkdown/kit/utils";
import {
  inlineFormulaAutoOpenPlugin,
  inlineFormulaInputRule,
} from "./input-rule";
import { createInlineFormulaNodeView } from "./node-view";
import { inlineFormulaRemark } from "./remark-inline-formula";
import { inlineFormulaSchema } from "./schema";

export const inlineFormulaPlugin = [
  inlineFormulaRemark,
  inlineFormulaSchema,
  $view(inlineFormulaSchema, () => createInlineFormulaNodeView()),
  inlineFormulaInputRule,
  inlineFormulaAutoOpenPlugin,
].flat();

export {
  inlineFormulaBridge,
  refreshInlineFormulas,
} from "./inlineFormulaState";
