import "../../App.css";

export type MapBlockType =
  | "blockquote"
  | "code_block"
  | "poetry_block"
  | "audio_block"
  | "image";

export interface DocumentBlock {
  typeName: string;
  level?: number;
  pos: number;
  nodeSize: number;
}

export interface DocumentMapState {
  blocks: DocumentBlock[];
  docSize: number;
}

export const ALL_MAP_BLOCK_TYPES: MapBlockType[] = [
  "blockquote",
  "code_block",
  "poetry_block",
  "audio_block",
  "image",
];

export const DEFAULT_DISTINGUISHED_TYPES: MapBlockType[] = [
  "blockquote",
  "code_block",
  "poetry_block",
];

export const BLOCK_TYPE_COLORS: Record<MapBlockType, string> = {
  blockquote: "var(--color-accent-2)",
  code_block: "var(--color-danger-2)",
  poetry_block: "var(--color-prose-poetry)",
  audio_block: "var(--color-info)",
  image: "var(--color-media)",
};

export const BLOCK_TYPE_LABELS: Record<MapBlockType, string> = {
  blockquote: "Citations",
  code_block: "Code",
  poetry_block: "Poésie",
  audio_block: "Audio",
  image: "Images",
};
