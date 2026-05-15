// Shell ProseMirror NodeView : monte AudioBlockComponent via createRoot.
// Seule responsabilité : créer le conteneur, passer les refs mutables au composant,
// et implémenter l'interface NodeView (update, stopEvent, ignoreMutation, destroy…).

import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { AudioBlockComponent } from "./AudioBlockComponent";
import type { AudioBlockConfig } from "./config";

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
    // Mis à jour par le composant à chaque render pour capturer l'état courant
    const playToggleRef: { current: () => void } = { current: () => {} };
    const nodeId = nextNodeId();

    // Listener barre espace : activé uniquement quand le bloc est sélectionné.
    // Phase capture pour intercepter avant ProseMirror (qui sinon remplacerait la sélection par un espace).
    function onSpaceKey(e: KeyboardEvent) {
      if (e.key !== " " || titleEditingRef.current) return;
      const target = e.target as HTMLElement;
      if (!target.closest?.(".ProseMirror")) return;
      e.preventDefault();
      e.stopPropagation();
      playToggleRef.current();
    }

    let root: Root | null = createRoot(container);

    function render() {
      root?.render(
        createElement(AudioBlockComponent, {
          nodeRef,
          selectedRef,
          titleEditingRef,
          playToggleRef,
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
        document.addEventListener("keydown", onSpaceKey, { capture: true });
        render();
      },

      deselectNode() {
        selectedRef.current = false;
        document.removeEventListener("keydown", onSpaceKey, { capture: true });
        render();
      },

      destroy() {
        document.removeEventListener("keydown", onSpaceKey, { capture: true });
        root?.unmount();
        root = null;
      },
    };
  };
}
