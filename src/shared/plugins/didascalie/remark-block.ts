import { $remark } from "@milkdown/kit/utils";
import type { Root, Paragraph, Text } from "mdast";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-didascalie-block");

// biome-ignore lint/suspicious/noExplicitAny: mdast hors typages stricts
type AnyParent = { type?: string; children: any[] };

function isBlockMarker(node: any): boolean {
    if (node.type !== "paragraph") return false;
    const p = node as Paragraph;
    return (
        p.children.length === 1 &&
        p.children[0].type === "text" &&
        ((p.children[0] as Text).value ?? "").trim() === "||"
    );
}

// Même logique que poetry-block : on regroupe ce qu'il y a entre 2 paires
// de paragraphes-marqueurs `||` dans un nœud `didascalie_block`.
function processChildren(parent: AnyParent): void {
    const result: any[] = [];
    let i = 0;

    while (i < parent.children.length) {
        const child = parent.children[i];

        if (isBlockMarker(child)) {
            let j = i + 1;
            while (j < parent.children.length && !isBlockMarker(parent.children[j])) {
                j++;
            }

            if (j < parent.children.length) {
                const inner = parent.children.slice(i + 1, j);
                const fakeParent: AnyParent = { children: [...inner] };
                processChildren(fakeParent);

                result.push({
                    type: "didascalie_block",
                    children: fakeParent.children,
                });

                log.info("bloc didascalie parsé", { enfants: inner.length });
                i = j + 1;
                continue;
            }
        }

        if (child.children && child.type !== "didascalie_block") {
            processChildren(child);
        }
        result.push(child);
        i++;
    }

    parent.children = result;
}

function remarkDidascalieBlock() {
    return (tree: Root) => {
        processChildren(tree as unknown as AnyParent);
    };
}

export const didascalieBlockRemark = $remark(
    "didascalieBlockRemark",
    () => remarkDidascalieBlock
);
