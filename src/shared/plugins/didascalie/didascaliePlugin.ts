import { didascalieInlineSchema } from "./inline-schema";
import { didascalieInputRulesPlugin } from "./input-rules";
import { didascalieInlineRemark } from "./remark-inline";

export {
  didascalieInlineSchema,
  didascalieInlineRemark,
  didascalieInputRulesPlugin,
};

// Mark inline rendue via toDOM (`<span data-didascalie-inline>`), pipes en CSS.
// Plus de NodeView ni de navigation custom : une marque se navigue nativement.
export const didascaliePlugin = [
  didascalieInlineSchema,
  didascalieInlineRemark,
  didascalieInputRulesPlugin,
].flat();
