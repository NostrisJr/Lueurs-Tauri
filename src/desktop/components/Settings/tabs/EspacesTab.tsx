import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  folderPathAtom,
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
} from "../../../../shared/lib/atoms";
import { toArray } from "../../../../shared/lib/fileTreeHelpers";
import { SystemField } from "../../../../shared/lib/noteTypes";
import {
  type VaultSpace,
  writeVaultConfig,
} from "../../../../shared/lib/vaultConfig";
import { persistNotePatch } from "../../../../shared/lib/vaultIO";
import { SpaceRow } from "./SpaceRow";

export function EspacesTab() {
  const folderPath = useAtomValue(folderPathAtom);
  const [vaultConfig, setVaultConfig] = useAtom(vaultConfigAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const setTree = useSetAtom(treeAtom);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!vaultConfig)
    return <p className="text-sm text-gray-400">Aucun vault chargé.</p>;

  function handleReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const spaces = vaultConfig?.spaces ?? [];
    const from = spaces.findIndex((s) => s.id === active.id);
    const to = spaces.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    updateSpaces(arrayMove(spaces, from, to));
  }

  async function updateSpaces(spaces: VaultSpace[]) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, spaces };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
  }

  function handleAddSpace() {
    updateSpaces([
      ...(vaultConfig?.spaces ?? []),
      { id: crypto.randomUUID(), name: "Nouvel espace" },
    ]);
  }

  function handleNameChange(index: number, name: string) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    spaces[index] = { ...spaces[index], name };
    updateSpaces(spaces);
  }

  function handleIconChange(index: number, icon: string) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    const updated = { ...spaces[index], icon: icon || undefined };
    if (!icon) updated.iconOnly = undefined;
    spaces[index] = updated;
    updateSpaces(spaces);
  }

  function handleColorChange(index: number, color: string) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    spaces[index] = { ...spaces[index], color: color || undefined };
    updateSpaces(spaces);
  }

  function handleIconOnlyChange(index: number, iconOnly: boolean) {
    const spaces = [...(vaultConfig?.spaces ?? [])];
    spaces[index] = { ...spaces[index], iconOnly: iconOnly || undefined };
    updateSpaces(spaces);
  }

  async function handleDelete(index: number) {
    const space = vaultConfig?.spaces[index];
    if (!space) return;

    // Nettoyer __space__ dans toutes les notes qui référencent cet espace
    const affectedNotes = [...notesById.values()].filter((note) =>
      toArray(note.frontmatter[SystemField.SPACE]).includes(space.name)
    );

    await Promise.all(
      affectedNotes.map((note) => {
        const remaining = toArray(note.frontmatter[SystemField.SPACE]).filter(
          (s) => s !== space.name
        );
        const updatedFrontmatter = {
          ...note.frontmatter,
          [SystemField.SPACE]: remaining.length > 0 ? remaining : undefined,
        };
        return persistNotePatch(
          note.id,
          updatedFrontmatter,
          note.body,
          setTree,
          folderPath ?? undefined
        );
      })
    );

    updateSpaces((vaultConfig?.spaces ?? []).filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleReorder}
      >
        <SortableContext
          items={vaultConfig.spaces.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {vaultConfig.spaces.map((space, i) => (
            <SpaceRow
              key={space.id}
              space={space}
              index={i}
              onIconChange={handleIconChange}
              onColorChange={handleColorChange}
              onNameChange={handleNameChange}
              onIconOnlyChange={handleIconOnlyChange}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={handleAddSpace}
        disabled={!folderPath}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors cursor-pointer"
      >
        + Ajouter un espace
      </button>
      <p className="text-xs text-gray-400">
        Taguez vos notes avec{" "}
        <code className="font-mono bg-gray-100 px-1 rounded">__space__</code>{" "}
        pour les associer à un espace.
      </p>
    </div>
  );
}
