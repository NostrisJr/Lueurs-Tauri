import { arrayMove } from "@dnd-kit/sortable";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRef } from "react";
import {
  activeSpaceAtom,
  folderPathAtom,
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
} from "../lib/atoms";
import { toArray } from "../lib/fileTreeHelpers";
import { SystemField } from "../lib/noteTypes";
import {
  ALL_SPACE_ID,
  type OrderedSpaceEntry,
  type VaultSpace,
  buildOrderedSpaces,
  saveVaultConfigCache,
  writeVaultConfig,
} from "../lib/vaultConfig";
import { persistNotePatch } from "../lib/vaultIO";

/**
 * Logique CRUD des espaces, partagée desktop/mobile. Les composants fournissent
 * leur propre rendu (lignes desktop vs réglages iOS) mais aucune logique métier.
 */
export function useSpacesEditor() {
  const folderPath = useAtomValue(folderPathAtom);
  const [vaultConfig, setVaultConfig] = useAtom(vaultConfigAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const setTree = useSetAtom(treeAtom);
  const [activeSpace, setActiveSpace] = useAtom(activeSpaceAtom);
  // Nom de l'espace au moment où l'édition a commencé (avant frappe), pour pouvoir
  // retagger les notes __space__ à la fin du renommage. Clé = space.id.
  const renameOriginalRef = useRef<Record<string, string>>({});

  const spaces = vaultConfig?.spaces ?? [];
  const canEdit = !!folderPath && !!vaultConfig;

  const orderedEntries: OrderedSpaceEntry[] = vaultConfig
    ? buildOrderedSpaces(spaces, vaultConfig)
    : [];

  // Ordre courant complet (IDs incluant ALL_SPACE_ID)
  function currentOrder(): string[] {
    const persisted = vaultConfig?.spaceOrder;
    if (persisted && persisted.length > 0) return persisted;
    return [ALL_SPACE_ID, ...spaces.map((s) => s.id)];
  }

  async function updateSpaces(next: VaultSpace[]) {
    if (!folderPath || !vaultConfig) return;
    // Nettoie spaceOrder des IDs d'espaces supprimés
    const nextIds = new Set(next.map((s) => s.id));
    const cleanOrder = currentOrder().filter(
      (id) => id === ALL_SPACE_ID || nextIds.has(id)
    );
    // Ajoute les nouveaux espaces absents de l'ordre
    for (const s of next) {
      if (!cleanOrder.includes(s.id)) cleanOrder.push(s.id);
    }
    const updated = { ...vaultConfig, spaces: next, spaceOrder: cleanOrder };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
    saveVaultConfigCache(folderPath, updated);
  }

  async function updateOrderOnly(newOrder: string[]) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, spaceOrder: newOrder };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
    saveVaultConfigCache(folderPath, updated);
  }

  // Garantit l'unicité du nom (clé métier des espaces) en suffixant un numéro.
  function uniqueName(name: string, excludeIndex: number): string {
    const trimmed = name.trim() || "Espace";
    const others = spaces
      .filter((_, i) => i !== excludeIndex)
      .map((s) => s.name);
    if (!others.includes(trimmed)) return trimmed;
    let n = 2;
    while (others.includes(`${trimmed} ${n}`)) n++;
    return `${trimmed} ${n}`;
  }

  function addSpace() {
    updateSpaces([
      ...spaces,
      { id: crypto.randomUUID(), name: uniqueName("Nouvel espace", -1) },
    ]);
  }

  // À appeler au focus du champ nom : mémorise le nom d'origine (celui avec lequel
  // les notes sont taguées) pour pouvoir les retagger une fois le renommage terminé.
  function beginRename(index: number) {
    const space = spaces[index];
    if (!space) return;
    if (!(space.id in renameOriginalRef.current)) {
      renameOriginalRef.current[space.id] = space.name;
    }
  }

  // Renommage live (sans dédup, pour ne pas gêner la frappe)
  function setName(index: number, name: string) {
    const next = [...spaces];
    next[index] = { ...next[index], name };
    updateSpaces(next);
  }

  // Applique `transform` au tableau __space__ de chaque note référençant
  // spaceName, et persiste. Partagé entre le renommage (retag) et la
  // suppression (retrait) d'un espace.
  async function updateAffectedNotesSpace(
    spaceName: string,
    transform: (current: string[]) => string[] | undefined
  ) {
    const affected = [...notesById.values()].filter((note) =>
      toArray(note.frontmatter[SystemField.SPACE]).includes(spaceName)
    );
    if (affected.length === 0) return;
    await Promise.all(
      affected.map((note) => {
        const next = transform(toArray(note.frontmatter[SystemField.SPACE]));
        return persistNotePatch(
          note.id,
          { ...note.frontmatter, [SystemField.SPACE]: next },
          note.body,
          setTree,
          folderPath ?? undefined
        );
      })
    );
  }

  // Retague __space__ dans toutes les notes qui référençaient l'ancien nom.
  async function migrateNotesSpaceName(oldName: string, newName: string) {
    if (oldName === newName) return;
    await updateAffectedNotesSpace(oldName, (current) => [
      // Set pour dédupliquer si newName était déjà présent par ailleurs
      ...new Set(current.map((s) => (s === oldName ? newName : s))),
    ]);
  }

  // Déduplication + retag des notes au moment où l'utilisateur quitte le champ (onBlur)
  async function dedupeName(index: number) {
    const space = spaces[index];
    if (!space) return;
    const current = space.name;
    const fixed = uniqueName(current, index);
    if (fixed !== current) {
      const next = [...spaces];
      next[index] = { ...next[index], name: fixed };
      await updateSpaces(next);
    }
    const originalName = renameOriginalRef.current[space.id];
    delete renameOriginalRef.current[space.id];
    if (originalName) await migrateNotesSpaceName(originalName, fixed);
  }

  function setIcon(index: number, icon: string) {
    const next = [...spaces];
    next[index] = { ...next[index], icon: icon || undefined };
    updateSpaces(next);
  }

  function setColor(index: number, color: string) {
    const next = [...spaces];
    next[index] = { ...next[index], color: color || undefined };
    updateSpaces(next);
  }

  async function setIconOnly(iconOnly: boolean) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, iconOnly: iconOnly || undefined };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
    saveVaultConfigCache(folderPath, updated);
  }

  async function setToutIcon(icon: string) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, toutIcon: icon || undefined };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
    saveVaultConfigCache(folderPath, updated);
  }

  // Réordonne la liste complète (espaces + "Tout")
  function reorder(activeId: string, overId: string) {
    const order = currentOrder();
    const from = order.indexOf(activeId);
    const to = order.indexOf(overId);
    if (from === -1 || to === -1) return;
    updateOrderOnly(arrayMove(order, from, to));
  }

  async function deleteSpace(index: number) {
    const space = spaces[index];
    if (!space) return;

    const confirmed = await ask(
      `Voulez-vous supprimer l'espace "${space.name}" ? Les notes qui lui sont associées ne seront pas supprimées.`,
      { title: "Suppression d'espace", kind: "warning" }
    );
    if (!confirmed) return;

    // Nettoyer __space__ dans toutes les notes qui référencent cet espace
    await updateAffectedNotesSpace(space.name, (current) => {
      const remaining = current.filter((s) => s !== space.name);
      return remaining.length > 0 ? remaining : undefined;
    });

    const remainingSpaces = spaces.filter((_, i) => i !== index);
    await updateSpaces(remainingSpaces);

    // Si l'espace supprimé était l'espace courant, basculer sur un autre espace existant
    if (activeSpace === space.name) {
      setActiveSpace(remainingSpaces[0]?.name ?? null);
    }
  }

  return {
    spaces,
    orderedEntries,
    canEdit,
    iconOnly: vaultConfig?.iconOnly ?? false,
    toutIcon: vaultConfig?.toutIcon,
    addSpace,
    beginRename,
    setName,
    dedupeName,
    setIcon,
    setColor,
    setIconOnly,
    setToutIcon,
    reorder,
    deleteSpace,
  };
}
