import { arrayMove } from "@dnd-kit/sortable";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
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
  }

  async function updateOrderOnly(newOrder: string[]) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, spaceOrder: newOrder };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
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

  // Renommage live (sans dédup, pour ne pas gêner la frappe)
  function setName(index: number, name: string) {
    const next = [...spaces];
    next[index] = { ...next[index], name };
    updateSpaces(next);
  }

  // Déduplication au moment où l'utilisateur quitte le champ (onBlur)
  function dedupeName(index: number) {
    const current = spaces[index]?.name ?? "";
    const fixed = uniqueName(current, index);
    if (fixed === current) return;
    const next = [...spaces];
    next[index] = { ...next[index], name: fixed };
    updateSpaces(next);
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
  }

  async function setToutIcon(icon: string) {
    if (!folderPath || !vaultConfig) return;
    const updated = { ...vaultConfig, toutIcon: icon || undefined };
    await writeVaultConfig(folderPath, updated);
    setVaultConfig(updated);
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

    // Nettoyer __space__ dans toutes les notes qui référencent cet espace
    const affected = [...notesById.values()].filter((note) =>
      toArray(note.frontmatter[SystemField.SPACE]).includes(space.name)
    );
    await Promise.all(
      affected.map((note) => {
        const remaining = toArray(note.frontmatter[SystemField.SPACE]).filter(
          (s) => s !== space.name
        );
        return persistNotePatch(
          note.id,
          {
            ...note.frontmatter,
            [SystemField.SPACE]: remaining.length > 0 ? remaining : undefined,
          },
          note.body,
          setTree,
          folderPath ?? undefined
        );
      })
    );

    updateSpaces(spaces.filter((_, i) => i !== index));
  }

  return {
    spaces,
    orderedEntries,
    canEdit,
    iconOnly: vaultConfig?.iconOnly ?? false,
    toutIcon: vaultConfig?.toutIcon,
    addSpace,
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
