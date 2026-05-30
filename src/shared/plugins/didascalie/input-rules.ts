import { schemaCtx } from "@milkdown/kit/core";
import { InputRule, inputRules } from "@milkdown/kit/prose/inputrules";
import { markRule } from "@milkdown/kit/prose";
import { TextSelection } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";

const log = createLogger("didascalie-input-rules");

// Helper : transforme un paragraphe vide contenant exactement `marker` en
// nœud `wrapperType` contenant un paragraphe vide (curseur dedans).
function wrapEmptyParagraph(
  state: any,
  _start: number,
  _end: number,
  wrapperTypeName: string
): any {
  const schema = state.schema;
  const wrapper = schema.nodes[wrapperTypeName];
  const paragraph = schema.nodes.paragraph;
  if (!wrapper || !paragraph) return null;

  const { $from } = state.selection;
  if ($from.parent.type !== paragraph) return null;

  // Le paragraphe doit être seul dans son parent (root, blockquote…) ;
  // les positions before/after couvrent le paragraphe entier.
  const blockBefore = $from.before($from.depth);
  const blockAfter = $from.after($from.depth);

  const newPara = paragraph.create();
  const wrapped = wrapper.create(null, newPara);

  const tr = state.tr.replaceRangeWith(blockBefore, blockAfter, wrapped);
  // Place le curseur dans le paragraphe vide à l'intérieur du nouveau bloc
  const cursorPos = blockBefore + 2; // entre wrapper et son premier paragraph
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  return tr;
}

// Règle bloc poésie : `§§` seul dans un paragraphe vide → wrap dans poetry_block.
const blockPoetryRule = new InputRule(/^§§$/, (state, _match, start, end) => {
  const tr = wrapEmptyParagraph(state, start, end, "poetry_block");
  if (tr) log.info("bloc poésie créé via input rule");
  return tr;
});

export const didascalieInputRulesPlugin = $prose((ctx) => {
  const didascalieType = ctx.get(schemaCtx).marks.didascalie_inline;
  // `||texte||` → applique la marque didascalie sur `texte` (markRule retire les
  // pipes et réinitialise les stored marks → on continue à taper hors marque).
  const inlineDidascalieRule = markRule(/\|\|([^|]+)\|\|$/, didascalieType, {
    beforeDispatch: ({ match }) => {
      log.info("didascalie inline créée via input rule", { text: match[1] });
    },
  });
  return inputRules({
    rules: [inlineDidascalieRule, blockPoetryRule],
  });
});
