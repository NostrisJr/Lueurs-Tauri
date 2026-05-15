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
      const regex = /\|([^|\n]+)\|/g;
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

function remarkDidascalieInline() {
  return (tree: Root) => {
    processInlineChildren(tree as AnyNode);
  };
}

export const didascalieInlineRemark = $remark(
  "didascalieInlineRemark",
  () => remarkDidascalieInline
);
