import { highlightColorPickerPlugin } from "./color-picker";
import { highlightInlineSchema } from "./highlight-schema";
import { highlightInputRulesPlugin } from "./input-rules";
import { highlightRemarkPlugin } from "./remark-highlight";

export { highlightInlineSchema };
export { DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLORS } from "./colors";
export type { HighlightColorId } from "./colors";
export { defaultHighlightColorRef } from "./defaultColorRef";

export const highlightPlugin = [
  highlightInlineSchema,
  highlightRemarkPlugin,
  highlightInputRulesPlugin,
  highlightColorPickerPlugin,
].flat();
