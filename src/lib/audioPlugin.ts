import { $node, $remark, $inputRule } from "@milkdown/kit/utils";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import directive from "remark-directive";
import { invoke } from "@tauri-apps/api/core";

export const remarkAudio = $remark("remarkAudio", () => directive);

export const audioNode = $node("audio_block", () => ({
    group: "block",
    atom: true,
    attrs: {
        src: { default: "" },
    },
    parseDOM: [
        {
            tag: "div[data-audio-src]",
            getAttrs: (dom) => ({
                src: (dom as HTMLElement).getAttribute("data-audio-src") ?? "",
            }),
        },
    ],
    toDOM: (node: any) => [
        "div",
        { "data-audio-src": node.attrs.src, class: "audio-block" },
    ],
    parseMarkdown: {
        match: (node: any) => node.type === "leafDirective" && node.name === "audio",
        runner: (state: any, node: any) => {
            state.addNode("audio_block", {
                src: (node.attributes as { src?: string }).src ?? "",
            });
        },
    },
    toMarkdown: {
        match: (node: any) => node.type.name === "audio_block",
        runner: (state: any, node: any) => {
            state.addNode("leafDirective", undefined, undefined, {
                name: "audio",
                attributes: { src: node.attrs.src },
            });
        },
    },
}));

export const audioInputRule = $inputRule(
    (ctx) =>
        new InputRule(/::audio\{src="([^"]+)"\}\s$/, (state, match, start, end) => {
            const [, src] = match;
            const nodeType = ctx.get(audioNode.node);
            const node = nodeType.create({ src });
            return state.tr.replaceRangeWith(start, end, node);
        })
);

async function renderAudio(container: HTMLElement, src: string) {
    container.innerHTML = "";

    let resolvedSrc = src;
    if (src.startsWith("/") || /^[A-Z]:\\/i.test(src)) {
        try {
            resolvedSrc = await invoke<string>("read_audio", { path: src });
        } catch (e) {
            console.error("[audio] impossible de lire le fichier:", e);
        }
    }

    const label = document.createElement("div");
    label.className = "text-xs text-gray-400 mb-1 truncate";
    label.textContent = src.split("/").pop() ?? src;

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.className = "w-full";
    audio.src = resolvedSrc;

    container.appendChild(label);
    container.appendChild(audio);
}

export function createAudioNodeView() {
    return (node: any) => {
        const wrapper = document.createElement("div");
        wrapper.className = "audio-block not-prose my-4";
        wrapper.setAttribute("data-audio-src", node.attrs.src);
        wrapper.contentEditable = "false";

        renderAudio(wrapper, node.attrs.src);

        return {
            dom: wrapper,
            update: (updatedNode: any) => {
                if (updatedNode.type.name !== "audio_block") return false;
                if (updatedNode.attrs.src !== node.attrs.src) {
                    renderAudio(wrapper, updatedNode.attrs.src);
                }
                return true;
            },
        };
    };
}