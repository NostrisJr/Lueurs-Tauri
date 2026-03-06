import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import type { AudioBlockConfig } from "./config";
import { createLogger } from "../../lib/logger";

const log = createLogger("audio-node-view");

let stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
    .audio-block-wrapper {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 16px;
        border: 1.5px solid var(--crepe-color-line, #e2e8f0);
        border-radius: 10px;
        background: var(--crepe-color-surface, #f8fafc);
        margin: 8px 0;
        position: relative;
        transition: border-color 0.15s;
        user-select: none;
    }
    .audio-block-wrapper:hover {
        border-color: var(--crepe-color-primary, #6366f1);
    }
    .audio-block-wrapper.ProseMirror-selectednode {
        outline: 2px solid var(--crepe-color-primary, #6366f1);
        outline-offset: 2px;
    }
    .audio-block-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .audio-block-icon {
        flex-shrink: 0;
        color: var(--crepe-color-primary, #6366f1);
        opacity: 0.85;
    }
    .audio-block-title {
        flex: 1;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--crepe-color-on-surface, #1e293b);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: default;
    }
    .audio-block-title[contenteditable="true"] {
        outline: none;
        border-bottom: 1.5px solid var(--crepe-color-primary, #6366f1);
        cursor: text;
        padding-bottom: 1px;
        white-space: normal;
        overflow: visible;
    }
    .audio-block-delete {
        flex-shrink: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--crepe-color-muted, #94a3b8);
        padding: 2px 4px;
        border-radius: 4px;
        line-height: 1;
        opacity: 0;
        transition: opacity 0.15s, color 0.15s;
        font-size: 14px;
    }
    .audio-block-wrapper:hover .audio-block-delete {
        opacity: 1;
    }
    .audio-block-delete:hover {
        color: #ef4444;
    }
    .audio-block-player {
        width: 100%;
        height: 36px;
        accent-color: var(--crepe-color-primary, #6366f1);
        border-radius: 6px;
    }
    .audio-block-src {
        font-size: 0.72rem;
        color: var(--crepe-color-muted, #94a3b8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    `;
    document.head.appendChild(style);
}

function musicIcon(): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("audio-block-icon");
    svg.innerHTML = `
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
    `;
    return svg;
}

export function createAudioBlockNodeView(config: AudioBlockConfig = {}) {
    return function audioBlockNodeView(
        initialNode: ProsemirrorNode,
        view: EditorView,
        getPos: () => number | undefined
    ): NodeView {
        injectStyles();

        let currentNode: ProsemirrorNode = initialNode;
        log.info("création node-view", { src: currentNode.attrs.src, title: currentNode.attrs.title });

        const wrapper = document.createElement("div");
        wrapper.classList.add("audio-block-wrapper");
        wrapper.setAttribute("data-audio-block", "");

        const header = document.createElement("div");
        header.classList.add("audio-block-header");

        const icon = musicIcon();

        const titleEl = document.createElement("span");
        titleEl.classList.add("audio-block-title");
        titleEl.textContent = currentNode.attrs.title || currentNode.attrs.src || "Audio";

        titleEl.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            titleEl.contentEditable = "true";
            titleEl.focus();
            const range = document.createRange();
            range.selectNodeContents(titleEl);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            log.info("édition titre démarrée");
        });

        titleEl.addEventListener("blur", () => {
            titleEl.contentEditable = "false";
            const pos = getPos();
            if (pos === undefined) return;
            const newTitle = titleEl.textContent?.trim() ?? "";
            log.info("titre mis à jour", { newTitle });
            view.dispatch(
                view.state.tr.setNodeMarkup(pos, undefined, {
                    ...currentNode.attrs,
                    title: newTitle,
                })
            );
        });

        titleEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); }
            if (e.key === "Escape") {
                titleEl.textContent = currentNode.attrs.title || currentNode.attrs.src || "Audio";
                titleEl.blur();
            }
            e.stopPropagation();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.classList.add("audio-block-delete");
        deleteBtn.setAttribute("aria-label", "Supprimer le bloc audio");
        deleteBtn.textContent = "✕";
        deleteBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            const pos = getPos();
            if (pos === undefined) return;
            log.info("suppression bloc audio", { src: currentNode.attrs.src });
            view.dispatch(view.state.tr.delete(pos, pos + currentNode.nodeSize));
        });

        header.appendChild(icon);
        header.appendChild(titleEl);
        header.appendChild(deleteBtn);

        const srcHint = document.createElement("div");
        srcHint.classList.add("audio-block-src");
        srcHint.textContent = currentNode.attrs.src.split(/[/\\]/).pop() ?? "";

        const audio = document.createElement("audio");
        audio.classList.add("audio-block-player");
        audio.controls = true;
        audio.preload = "metadata";

        async function resolveAndSetSrc(src: string) {
            if (!src) return;
            log.info("résolution src audio", { src });
            try {
                const resolved = config.resolveAudioPath
                    ? await config.resolveAudioPath(src)
                    : src;
                log.info("src audio résolu", { resolved });
                audio.src = resolved;
            } catch (err) {
                log.error("échec résolution src audio", err);
                audio.src = src;
            }
        }
        resolveAndSetSrc(currentNode.attrs.src);

        audio.addEventListener("mousedown", (e) => e.stopPropagation());
        audio.addEventListener("click", (e) => e.stopPropagation());
        audio.addEventListener("error", () => {
            log.error("erreur lecture audio", { src: audio.src, error: audio.error?.message });
        });

        wrapper.appendChild(header);
        wrapper.appendChild(srcHint);
        wrapper.appendChild(audio);

        return {
            dom: wrapper,

            update(updatedNode: ProsemirrorNode) {
                if (updatedNode.type.name !== "audio_block") return false;

                if (updatedNode.attrs.src !== currentNode.attrs.src) {
                    log.info("src audio changé", { old: currentNode.attrs.src, new: updatedNode.attrs.src });
                    resolveAndSetSrc(updatedNode.attrs.src);
                    srcHint.textContent = updatedNode.attrs.src.split(/[/\\]/).pop() ?? "";
                }

                if (
                    document.activeElement !== titleEl &&
                    updatedNode.attrs.title !== currentNode.attrs.title
                ) {
                    titleEl.textContent = updatedNode.attrs.title || updatedNode.attrs.src || "Audio";
                }

                currentNode = updatedNode;
                return true;
            },

            stopEvent(event: Event) {
                if (titleEl.contentEditable === "true") return true;
                const target = event.target as EventTarget;
                if (target === audio || audio.contains(target as globalThis.Node)) return true;
                return false;
            },

            ignoreMutation() { return true; },

            selectNode() { wrapper.classList.add("ProseMirror-selectednode"); },
            deselectNode() { wrapper.classList.remove("ProseMirror-selectednode"); },

            destroy() {
                log.info("destruction node-view", { src: currentNode.attrs.src });
                audio.pause();
                audio.src = "";
                audio.load();
            },
        };
    };
}