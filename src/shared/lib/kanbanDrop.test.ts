import { describe, expect, it } from "vitest";
import { KANBAN_TRASH_ID, resolveKanbanDrop } from "./kanbanDrop";

const columnIds = ["col-a", "col-b", "__no_value__"];
// Cartes : note-1 en col-a, note-2 en col-b
const columnOfNote = (id: string) =>
  ({ "note-1": "col-a", "note-2": "col-b" })[id] ?? null;

function resolve(overId: string | null, fromColId = "col-a") {
  return resolveKanbanDrop({ overId, fromColId, columnIds, columnOfNote });
}

describe("resolveKanbanDrop", () => {
  it("ignore un lâcher hors de toute cible", () => {
    expect(resolve(null)).toBeNull();
    expect(resolve("cible-inconnue")).toBeNull();
  });

  it("déplace vers la colonne lâchée", () => {
    expect(resolve("col-b")).toEqual({ kind: "move", toColId: "col-b" });
  });

  it("déplace vers la colonne de la carte survolée", () => {
    expect(resolve("note-2")).toEqual({ kind: "move", toColId: "col-b" });
  });

  it("traite la colonne virtuelle « Sans valeur » comme une cible normale", () => {
    expect(resolve("__no_value__")).toEqual({
      kind: "move",
      toColId: "__no_value__",
    });
  });

  it("ignore un lâcher dans la colonne d'origine", () => {
    // Sur la colonne elle-même comme sur une de ses cartes : le réordonnancement
    // intra-colonne n'est pas persisté (l'ordre vient de __Children__).
    expect(resolve("col-a")).toBeNull();
    expect(resolve("note-1")).toBeNull();
  });

  it("supprime la note lâchée sur la corbeille, quelle que soit sa colonne", () => {
    expect(resolve(KANBAN_TRASH_ID)).toEqual({ kind: "delete" });
    expect(resolve(KANBAN_TRASH_ID, "__no_value__")).toEqual({
      kind: "delete",
    });
  });
});
