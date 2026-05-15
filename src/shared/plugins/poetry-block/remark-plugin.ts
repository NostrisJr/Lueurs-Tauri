import { $remark } from "@milkdown/kit/utils";
import type { Paragraph, Root, Text } from "mdast";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-poetry");

// biome-ignore lint/suspicious/noExplicitAny: mdast nodes manipulés en dehors des types
type AnyParent = { children: any[] };

function isPoetryMarker(node: any): boolean {
  if (node.type !== "paragraph") return false;
  const p = node as Paragraph;
  return (
    p.children.length === 1 &&
    p.children[0].type === "text" &&
    ((p.children[0] as Text).value ?? "").trim() === "§§"
  );
}

// Parcourt récursivement tous les nœuds-parents et convertit les paires §§...§§
// en nœuds poetry_block dans leurs children.
function processChildren(parent: AnyParent): void {
  const result: any[] = [];
  let i = 0;

  while (i < parent.children.length) {
    const child = parent.children[i];

    if (isPoetryMarker(child)) {
      let j = i + 1;
      while (
        j < parent.children.length &&
        !isPoetryMarker(parent.children[j])
      ) {
        j++;
      }

      if (j < parent.children.length) {
        // Paire trouvée : on enveloppe le contenu intermédiaire
        const inner = parent.children.slice(i + 1, j);
        const fakeParent: AnyParent = { children: [...inner] };
        processChildren(fakeParent);

        result.push({
          type: "poetry_block",
          children: fakeParent.children,
        });

        log.info("bloc poésie parsé", { enfants: inner.length });
        i = j + 1;
        continue;
      }
    }

    // Récursion sur les nœuds-conteneurs non-poetry
    if (child.children && child.type !== "poetry_block") {
      processChildren(child);
    }
    result.push(child);
    i++;
  }

  parent.children = result;
}

function remarkPoetryBlock() {
  return (tree: Root) => {
    processChildren(tree as unknown as AnyParent);
  };
}

export const poetryBlockRemark = $remark(
  "poetryBlockRemark",
  () => remarkPoetryBlock
);
