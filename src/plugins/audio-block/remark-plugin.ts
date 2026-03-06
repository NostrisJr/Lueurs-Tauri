import { $remark } from "@milkdown/kit/utils";
import type { Root, Link, Text } from "mdast";
import { visit, SKIP } from "unist-util-visit";
import { createLogger } from "../../lib/logger";

const log = createLogger("remark-audio");

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|weba)(\?.*)?$/i;

function isAudioUrl(url: string): boolean {
    return AUDIO_EXTENSIONS.test(url);
}

function linkTitle(node: Link): string {
    const first = node.children[0];
    return first && first.type === "text" ? (first as Text).value : "";
}

function remarkAudioBlockTransformer() {
    return (tree: Root) => {
        let replaced = 0;
        visit(tree, "paragraph", (paragraphNode, index, parent) => {
            if (!parent || index === undefined) return;

            if (
                paragraphNode.children.length === 1 &&
                paragraphNode.children[0].type === "link"
            ) {
                const linkNode = paragraphNode.children[0] as Link;
                if (isAudioUrl(linkNode.url)) {
                    log.info("lien audio détecté → audio_block", {
                        src: linkNode.url,
                        title: linkTitle(linkNode),
                    });
                    (parent.children as any[])[index] = {
                        type: "audio_block",
                        src: linkNode.url,
                        title: linkTitle(linkNode),
                        data: { hName: "audio_block" },
                    };
                    replaced++;
                    return [SKIP, index];
                }
            }
        });
        if (replaced > 0) log.info(`${replaced} bloc(s) audio transformé(s)`);
    };
}

export const audioBlockRemark = $remark(
    "audioBlockRemark",
    () => remarkAudioBlockTransformer
);