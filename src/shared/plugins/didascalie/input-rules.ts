import { InputRule, inputRules } from "@milkdown/kit/prose/inputrules";
import { TextSelection } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";

const log = createLogger("didascalie-input-rules");

// Règle inline : `|texte|` (à la fermeture du second |) → nœud didascalie_inline.
// Le pattern exclut les pipes intermédiaires et les retours-ligne.
const inlineDidascalieRule = new InputRule(
  /\|([^|\n]+)\|$/,
  (state, match, start, end) => {
    const schema = state.schema;
    const didascalieType = schema.nodes.didascalie_inline;
    if (!didascalieType) return null;

    // Ne pas déclencher si on est déjà dans une didascalie ou un nœud code
    const $start = state.doc.resolve(start);
    for (let d = $start.depth; d > 0; d--) {
      const t = $start.node(d).type.name;
      if (t === "didascalie_inline" || t === "code_block") return null;
    }

    const text = match[1];
    if (!text) return null;

    const node = didascalieType.create(null, schema.text(text));
    const tr = state.tr.replaceWith(start, end, node);
    // Place le curseur APRÈS le nœud (sortie du bloc inline pour continuer à taper)
    const after = start + node.nodeSize;
    tr.setSelection(TextSelection.create(tr.doc, after));
    log.info("didascalie inline créée via input rule", { text });
    return tr;
  }
);

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

// Règle bloc didascalie : `||` seul dans un paragraphe vide → wrap dans didascalie_block.
const blockDidascalieRule = new InputRule(
  /^\|\|$/,
  (state, _match, start, end) => {
    const tr = wrapEmptyParagraph(state, start, end, "didascalie_block");
    if (tr) log.info("bloc didascalie créé via input rule");
    return tr;
  }
);

// Règle bloc poésie : `§§` seul dans un paragraphe vide → wrap dans poetry_block.
const blockPoetryRule = new InputRule(/^§§$/, (state, _match, start, end) => {
  const tr = wrapEmptyParagraph(state, start, end, "poetry_block");
  if (tr) log.info("bloc poésie créé via input rule");
  return tr;
});

export const didascalieInputRulesPlugin = $prose(() =>
  inputRules({
    rules: [inlineDidascalieRule, blockDidascalieRule, blockPoetryRule],
  })
);
