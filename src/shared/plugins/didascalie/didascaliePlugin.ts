import { $view } from "@milkdown/kit/utils";
import { didascalieInlineSchema } from "./inline-schema";
import { didascalieInlineRemark } from "./remark-inline";
import { didascalieBlockSchema } from "./block-schema";
import { didascalieBlockRemark } from "./remark-block";
import { didascalieInputRulesPlugin } from "./input-rules";
import { didascalieNavigationPlugin } from "./navigation";
import { createDidascalieInlineNodeView } from "./inline-node-view";

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
