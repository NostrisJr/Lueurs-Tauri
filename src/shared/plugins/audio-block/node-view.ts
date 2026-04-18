// Shell ProseMirror NodeView : monte AudioBlockComponent via createRoot.
// Seule responsabilité : créer le conteneur, passer les refs mutables au composant,
// et implémenter l'interface NodeView (update, stopEvent, ignoreMutation, destroy…).

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import type { AudioBlockConfig } from "./config";
import { AudioBlockComponent } from "./AudioBlockComponent";

let _nodeCounter = 0;
function nextNodeId() {
  return `audio-node-${++_nodeCounter}`;
}

export function createAudioBlockNodeView(config: AudioBlockConfig = {}) {
  return function audioBlockNodeView(
    initialNode: ProsemirrorNode,
    view: EditorView,
    getPos: () => number | undefined
  ): NodeView {
    const container = document.createElement("div");
    // Refs mutables partagés avec le composant — le shell les mute avant chaque render
    const nodeRef = { current: initialNode };
    const selectedRef = { current: false };
    const titleEditingRef = { current: false };
    const nodeId = nextNodeId();

    let root: Root | null = createRoot(container);

    function render() {
      root?.render(
        createElement(AudioBlockComponent, {
          nodeRef,
          selectedRef,
          titleEditingRef,
          view,
          getPos,
          config,
          nodeId,
        })
      );
    }

    render();

    return {
      dom: container,

      update(updatedNode: ProsemirrorNode) {
        if (updatedNode.type.name !== "audio_block") return false;
        nodeRef.current = updatedNode;
        render();
        return true;
      },

      stopEvent(event: Event) {
        if (titleEditingRef.current) return true;
        const t = event.target as HTMLElement;
        // Waveform et controls ont data-ab-interactive ; le header non
        // (pour que ProseMirror gère la sélection du nœud au clic sur le titre)
        return !!t.closest?.("[data-ab-interactive]");
      },

      ignoreMutation() {
        return true;
      },

      selectNode() {
        selectedRef.current = true;
        render();
      },

      deselectNode() {
        selectedRef.current = false;
        render();
      },

      destroy() {
        root?.unmount();
        root = null;
      },
    };
  };
}
