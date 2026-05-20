import { $view } from "@milkdown/kit/utils";
import { createDidascalieInlineNodeView } from "./inline-node-view";
import { didascalieInlineSchema } from "./inline-schema";
import { didascalieInputRulesPlugin } from "./input-rules";
import { didascalieNavigationPlugin } from "./navigation";
import { didascalieInlineRemark } from "./remark-inline";

export {
  didascalieInlineSchema,
  didascalieInlineRemark,
  didascalieInputRulesPlugin,
  didascalieNavigationPlugin,
};

export const didascaliePlugin = [
  didascalieInlineSchema,
  didascalieInlineRemark,
  $view(didascalieInlineSchema, () => createDidascalieInlineNodeView()),
  didascalieInputRulesPlugin,
  didascalieNavigationPlugin,
].flat();
