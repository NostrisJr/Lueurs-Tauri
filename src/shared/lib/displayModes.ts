import { sfBooksVertical, sfTextRectanglePage } from "@bradleyhodges/sfsymbols";
import type { IconDefinition } from "@bradleyhodges/sfsymbols-types";
import type { DisplayMode } from "./Atoms";

export const DISPLAY_MODES: {
  value: DisplayMode;
  icon: IconDefinition;
  label: string;
}[] = [
  { value: "normal", icon: sfTextRectanglePage, label: "Normal" },
  { value: "livre", icon: sfBooksVertical, label: "Livre" },
];
