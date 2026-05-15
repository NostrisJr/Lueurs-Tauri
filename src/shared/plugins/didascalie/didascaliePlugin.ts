import { $view } from "@milkdown/kit/utils";
import { didascalieBlockSchema } from "./block-schema";
import { createDidascalieInlineNodeView } from "./inline-node-view";
import { didascalieInlineSchema } from "./inline-schema";
import { didascalieInputRulesPlugin } from "./input-rules";
import { didascalieNavigationPlugin } from "./navigation";
import { didascalieBlockRemark } from "./remark-block";
import { didascalieInlineRemark } from "./remark-inline";

export {
  didascalieInlineSchema,
  didascalieInlineRemark,
  didascalieBlockSchema,
  didascalieBlockRemark,
  didascalieInputRulesPlugin,
  didascalieNavigationPlugin,
};

export const didascaliePlugin = [
  didascalieInlineSchema,
  didascalieInlineRemark,
  $view(didascalieInlineSchema, () => createDidascalieInlineNodeView()),
  didascalieBlockSchema,
  didascalieBlockRemark,
  didascalieInputRulesPlugin,
  didascalieNavigationPlugin,
].flat();
