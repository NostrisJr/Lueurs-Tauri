import type { DisplayMode } from "./Atoms";
import { IconBooksVertical, IconTextRectanglePage } from "../components/PlatformIcon";

export const DISPLAY_MODES: {
  value: DisplayMode;
  Icon: React.FC<{ className?: string }>;
  label: string;
}[] = [
  { value: "normal", Icon: IconTextRectanglePage, label: "Normal" },
  { value: "livre",  Icon: IconBooksVertical,     label: "Livre" },
];
