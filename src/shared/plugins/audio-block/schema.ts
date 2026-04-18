/**
 * schema.ts
 *
 * Définit le nœud ProseMirror `audio_block` :
 *   - parseMarkdown  : depuis l'AST mdast produit par remark-plugin.ts
 *   - toMarkdown     : sérialise en `[titre](src)` dans le markdown
 *   - toDOM / parseDOM : représentation DOM native (fallback)
 *
 * La vraie UI interactive (lecteur audio) est dans node-view.ts.
 */

import { $node } from "@milkdown/kit/utils";

export const audioBlockSchema = $node("audio_block", () => ({
    // Bloc de niveau supérieur, non éditable à l'intérieur
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    isolating: true,
    marks: "",

    attrs: {
        src: { default: "" },
        title: { default: "" },
    },

    // ── DOM natif (utilisé quand aucune NodeView n'est montée) ────────────
    parseDOM: [
        {
            tag: "div[data-audio-block]",
            getAttrs: (dom: HTMLElement | string) => {
                if (typeof dom === "string") return false;
                return {
                    src: dom.getAttribute("data-src") ?? "",
                    title: dom.getAttribute("data-title") ?? "",
                };
            },
        },
    ],
    toDOM: (node: any) => [
        "div",
        {
            "data-audio-block": "",
            "data-src": node.attrs.src,
            "data-title": node.attrs.title,
            contenteditable: "false",
        },
    ],

    // ── Parser Markdown → ProseMirror ─────────────────────────────────────
    parseMarkdown: {
        match: (node: any) => node.type === "audio_block",
        runner: (state: any, node: any, type: any) => {
            state.addNode(type, {
                src: node.src ?? "",
                title: node.title ?? "",
            });
        },
    },

    // ── Sérialiseur ProseMirror → Markdown ────────────────────────────────
    // On émet directement un nœud `link` mdast (sans paragraph wrapper)
    // pour éviter l'échappement des crochets \[ produit par certaines
    // versions de mdast-util-to-markdown.
    toMarkdown: {
        match: (node: any) => node.type.name === "audio_block",
        runner: (state: any, node: any) => {
            const { src, title } = node.attrs;
            state.openNode("paragraph");
            state.addNode("link", undefined, title || src, {
                url: src,
                title: null,
            });
            state.closeNode();
        },
    },
}));