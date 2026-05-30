import { schemaCtx } from "@milkdown/kit/core";
import { inputRules } from "@milkdown/kit/prose/inputrules";
import { markRule } from "@milkdown/kit/prose";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";
import { defaultHighlightColorRef } from "./defaultColorRef";

const log = createLogger("highlight-input-rules");

/**
 * Règle inline : `=={color}texte==` ou `==texte==` → marque highlight_inline.
 * markRule retire les délimiteurs, applique la marque sur `texte`, et réinitialise
 * les stored marks (marque non-inclusive → on continue à taper hors surlignage).
 */
export const highlightInputRulesPlugin = $prose((ctx) => {
  const hlType = ctx.get(schemaCtx).marks.highlight_inline;
  const rule = markRule(/==(?:\{([a-z]+)\})?([^=\n]+)==$/, hlType, {
    getAttr: (match) => ({
      color: match[1] ?? defaultHighlightColorRef.current,
    }),
    beforeDispatch: ({ match }) => {
      log.info("highlight créé via input rule", {
        color: match[1] ?? defaultHighlightColorRef.current,
        text: match[2],
      });
    },
  });
  return inputRules({ rules: [rule] });
});
