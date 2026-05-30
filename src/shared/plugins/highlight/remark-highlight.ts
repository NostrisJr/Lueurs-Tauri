import { $remark } from "@milkdown/kit/utils";
import type { Root } from "mdast";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-highlight");

// Types dans lesquels on ne cherche pas le pattern (pour éviter les faux positifs)
const SKIP_PARENTS = new Set([
  "tableCell",
  "tableRow",
  "table",
  "code",
  "inlineCode",
  "highlight",
]);

// biome-ignore lint/suspicious/noExplicitAny: mdast hors typages stricts
type AnyNode = any;

const HIGHLIGHT_RE = /==(?:\{([a-z]+)\})?([^=]+)==/g;

function processChildren(parent: AnyNode): void {
  if (!parent.children) return;
  if (SKIP_PARENTS.has(parent.type)) return;

  const newChildren: AnyNode[] = [];
  let totalReplaced = 0;

  for (const child of parent.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const text = child.value as string;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const parts: AnyNode[] = [];

      HIGHLIGHT_RE.lastIndex = 0;
      // biome-ignore lint/suspicious/noAssignInExpressions: pattern standard des regex globales
      while ((match = HIGHLIGHT_RE.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            value: text.slice(lastIndex, match.index),
          });
        }
        const color = match[1] ?? "yellow";
        const content = match[2];
        parts.push({
          type: "highlight",
          color,
          children: [{ type: "text", value: content }],
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
      if (child.children) processChildren(child);
      newChildren.push(child);
    }
  }

  parent.children = newChildren;
  if (totalReplaced > 0) {
    log.info("highlights parsés", { dans: parent.type, n: totalReplaced });
  }
}

// Attacher unified : (1) handler remark-stringify sérialisant le nœud mdast
// `highlight` en `=={color}texte==`, (2) parsing texte → nœud à la lecture.
function remarkHighlight(this: AnyNode) {
  const data = this.data();
  const toMarkdownExtensions =
    data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
  toMarkdownExtensions.push({
    handlers: {
      highlight(node: AnyNode, _parent: AnyNode, state: AnyNode, info: AnyNode) {
        const color = node.color ?? "yellow";
        const exit = state.enter("highlight");
        const value = state.containerPhrasing(node, {
          ...info,
          before: "=",
          after: "=",
        });
        exit();
        return `=={${color}}${value}==`;
      },
    },
  });

  return (tree: Root) => {
    processChildren(tree as AnyNode);
  };
}

export const highlightRemarkPlugin = $remark(
  "highlightRemark",
  () => remarkHighlight
);
