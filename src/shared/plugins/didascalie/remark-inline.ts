import { $remark } from "@milkdown/kit/utils";
import type { Root } from "mdast";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-didascalie-inline");

// Types qu'on ne traverse pas : tableaux (le `|` y est syntaxe), code (litteral),
// et les didascalie_inline elles-mêmes (pas de nesting).
const SKIP_PARENTS = new Set([
  "tableCell",
  "tableRow",
  "table",
  "code",
  "inlineCode",
  "didascalie_inline",
]);

// biome-ignore lint/suspicious/noExplicitAny: mdast hors typages stricts
type AnyNode = any;

function processInlineChildren(parent: AnyNode): void {
  if (!parent.children) return;
  if (SKIP_PARENTS.has(parent.type)) return;

  const newChildren: AnyNode[] = [];
  let totalReplaced = 0;

  for (const child of parent.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const text = child.value as string;
      const regex = /\|\|([^|]+)\|\|/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const parts: AnyNode[] = [];

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            value: text.slice(lastIndex, match.index),
          });
        }
        parts.push({
          type: "didascalie_inline",
          children: [{ type: "text", value: match[1] }],
        });
        totalReplaced++;
        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) {
        newChildren.push(child);
      } else {
        if (lastIndex < text.length) {
          parts.push({ type: "text", value: text.slice(lastIndex) });
        }
        newChildren.push(...parts);
      }
    } else {
      // Récursion sur les nœuds-conteneurs
      if (child.children) processInlineChildren(child);
      newChildren.push(child);
    }
  }

  parent.children = newChildren;
  if (totalReplaced > 0) {
    log.info("didascalies inline parsées", {
      dans: parent.type,
      n: totalReplaced,
    });
  }
}

// Attacher unified : (1) enregistre un handler remark-stringify qui sérialise
// le nœud mdast `didascalie_inline` en `||texte||`, (2) transforme le texte
// `||texte||` en nœud `didascalie_inline` à la lecture.
function remarkDidascalieInline(this: AnyNode) {
  const data = this.data();
  const toMarkdownExtensions =
    data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
  toMarkdownExtensions.push({
    handlers: {
      didascalie_inline(node: AnyNode, _parent: AnyNode, state: AnyNode, info: AnyNode) {
        const exit = state.enter("didascalie_inline");
        const value = state.containerPhrasing(node, {
          ...info,
          before: "|",
          after: "|",
        });
        exit();
        return `||${value}||`;
      },
    },
  });

  return (tree: Root) => {
    processInlineChildren(tree as AnyNode);
  };
}

export const didascalieInlineRemark = $remark(
  "didascalieInlineRemark",
  () => remarkDidascalieInline
);
