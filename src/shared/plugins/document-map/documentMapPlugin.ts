import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import type {
  DocumentBlock,
  DocumentMapState,
} from "../../lib/documentMapConfig";

const documentMapKey = new PluginKey("documentMap");

// biome-ignore lint/suspicious/noExplicitAny: nœuds ProseMirror non typés
function classifyNode(node: any, offset: number): DocumentBlock {
  const typeName: string = node.type.name;

  if (typeName === "heading") {
    return {
      typeName: "heading",
      level: node.attrs.level ?? 1,
      pos: offset,
      nodeSize: node.nodeSize,
    };
  }
  if (typeName === "code_block" || typeName === "fence") {
    return { typeName: "code_block", pos: offset, nodeSize: node.nodeSize };
  }
  if (typeName === "blockquote") {
    return { typeName: "blockquote", pos: offset, nodeSize: node.nodeSize };
  }
  if (typeName === "audio_block") {
    return { typeName: "audio_block", pos: offset, nodeSize: node.nodeSize };
  }
  if (typeName === "poetry_block") {
    return { typeName: "poetry_block", pos: offset, nodeSize: node.nodeSize };
  }
  if (typeName === "didascalie_block") {
    return {
      typeName: "didascalie_block",
      pos: offset,
      nodeSize: node.nodeSize,
    };
  }
  // Paragraphe contenant une image
  if (typeName === "paragraph") {
    let hasImage = false;
    // biome-ignore lint/complexity/noForEach: forEach de ProseMirror Node, pas Array.prototype
    // biome-ignore lint/suspicious/noExplicitAny: nœuds ProseMirror non typés
    node.forEach((child: any) => {
      if (child.type.name === "image") hasImage = true;
    });
    if (hasImage)
      return { typeName: "image", pos: offset, nodeSize: node.nodeSize };
    return { typeName: "paragraph", pos: offset, nodeSize: node.nodeSize };
  }
  // bullet_list, ordered_list, task_list → liste
  if (
    typeName === "bullet_list" ||
    typeName === "ordered_list" ||
    typeName === "task_list"
  ) {
    return { typeName: "list", pos: offset, nodeSize: node.nodeSize };
  }
  // Tout le reste (types inconnus) → paragraphe
  return { typeName: "paragraph", pos: offset, nodeSize: node.nodeSize };
}

// biome-ignore lint/suspicious/noExplicitAny: document ProseMirror non typé
function extractMap(doc: any): DocumentMapState {
  const blocks: DocumentBlock[] = [];
  // biome-ignore lint/complexity/noForEach: forEach de ProseMirror Node, pas Array.prototype
  // biome-ignore lint/suspicious/noExplicitAny: nœuds ProseMirror non typés
  doc.forEach((node: any, offset: number) =>
    blocks.push(classifyNode(node, offset))
  );
  return { blocks, docSize: doc.nodeSize };
}

export function createDocumentMapPlugin(callbackRef: {
  current: ((map: DocumentMapState) => void) | null;
}) {
  return $prose(
    () =>
      new Plugin({
        key: documentMapKey,
        state: {
          init(_, state) {
            callbackRef.current?.(extractMap(state.doc));
            return null;
          },
          apply(tr, _, __, newState) {
            if (tr.docChanged) callbackRef.current?.(extractMap(newState.doc));
            return null;
          },
        },
      })
  );
}
