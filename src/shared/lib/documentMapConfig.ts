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
  blockquote: "var(--color-amber-400)",
  code_block: "var(--color-red-400)",
  poetry_block: "var(--color-lime-500)",
  audio_block: "var(--color-blue-500)",
  image: "var(--color-pink-500)",
};

export const BLOCK_TYPE_LABELS: Record<MapBlockType, string> = {
  blockquote: "Citations",
  code_block: "Code",
  poetry_block: "Poésie",
  audio_block: "Audio",
  image: "Images",
};
