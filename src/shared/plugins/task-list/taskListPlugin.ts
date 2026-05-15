import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type {
  EditorView,
  NodeView,
  ViewMutationRecord,
} from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { createLogger } from "../../lib/logger";

const log = createLogger("task-list-plugin");
const taskListKey = new PluginKey("taskListCheckbox");

function buildListItemNodeView(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  initialNode: any,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  let currentNode: ProsemirrorNode = initialNode;

  const li = document.createElement("li");

  // Cas liste normale : rendu minimal, bullet géré par CSS ::before
  if (currentNode.attrs.checked === null) {
    return {
      dom: li,
      contentDOM: li,
      // biome-ignore lint/suspicious/noExplicitAny: NodeViewConstructor ProseMirror
      update(updated: any) {
        if (updated.type.name !== "list_item") return false;
        if (updated.attrs.checked !== null) return false;
        currentNode = updated;
        return true;
      },
    };
  }

  // Cas task list item
  li.classList.add("task-list-item");
  li.setAttribute("data-item-type", "task");
  li.setAttribute("data-checked", String(currentNode.attrs.checked));

  // contenteditable="false" sur le wrapper empêche PM de placer le curseur
  // dans la zone checkbox (évite le curseur minuscule au clic à gauche)
  const checkboxWrapper = document.createElement("span");
  checkboxWrapper.contentEditable = "false";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-list-checkbox";
  checkbox.checked = currentNode.attrs.checked === true;

  // change se déclenche après le toggle natif du browser (visuellement déjà correct)
  checkbox.addEventListener("change", () => {
    const pos = getPos();
    if (pos === undefined) return;
    log.info("toggle task checkbox", { pos, checked: checkbox.checked });
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        checked: checkbox.checked,
      })
    );
  });

  checkboxWrapper.appendChild(checkbox);

  const content = document.createElement("span");
  content.className = "task-list-item-content";

  li.appendChild(checkboxWrapper);
  li.appendChild(content);

  return {
    dom: li,
    contentDOM: content,

    // biome-ignore lint/suspicious/noExplicitAny: NodeViewConstructor ProseMirror
    update(updated: any) {
      if (updated.type.name !== "list_item") return false;
      // Si le nœud redevient une liste normale, forcer la recréation
      if (updated.attrs.checked === null) return false;
      // Sync checkbox si checked a changé depuis l'extérieur (undo/redo)
      if (updated.attrs.checked !== currentNode.attrs.checked) {
        checkbox.checked = updated.attrs.checked === true;
        li.setAttribute("data-checked", String(updated.attrs.checked));
      }
      currentNode = updated;
      return true;
    },

    stopEvent(event: Event) {
      // Laisser la zone checkbox gérer ses propres événements sans interférence PM
      const target = event.target as Node;
      return target === checkbox || checkboxWrapper.contains(target);
    },

    ignoreMutation(mutation: ViewMutationRecord) {
      const target = mutation.target as Node;
      // Bloquer uniquement la zone checkbox
      if (target === checkboxWrapper || checkboxWrapper.contains(target))
        return true;
      // Bloquer les changements d'attributs qu'on gère nous-mêmes
      if (
        "attributeName" in mutation &&
        mutation.attributeName === "data-checked"
      )
        return true;
      // Laisser PM reconcilier les mutations structurelles
      return false;
    },
  };
}

export const taskListPlugin = $prose(
  () =>
    new Plugin({
      key: taskListKey,
      props: {
        nodeViews: {
          list_item: buildListItemNodeView,
        },
      },
    })
);
