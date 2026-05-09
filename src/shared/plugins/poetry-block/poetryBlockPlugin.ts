import { poetryBlockSchema } from "./schema";
import { poetryBlockRemark } from "./remark-plugin";

export { poetryBlockSchema, poetryBlockRemark };
export const poetryBlockPlugin = [poetryBlockSchema, poetryBlockRemark].flat();
