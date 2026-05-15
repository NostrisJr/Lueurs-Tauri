import { poetryBlockRemark } from "./remark-plugin";
import { poetryBlockSchema } from "./schema";

export { poetryBlockSchema, poetryBlockRemark };
export const poetryBlockPlugin = [poetryBlockSchema, poetryBlockRemark].flat();
