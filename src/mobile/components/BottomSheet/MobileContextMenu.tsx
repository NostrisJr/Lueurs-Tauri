import { useAtom, useAtomValue, useStore } from "jotai";
import { useEffect, useState } from "react";
import { useNote } from "../../../shared/hooks/useNote";
import {
  mobileContextMenuAtom,
  notesByIdAtom,
  treeAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { toArray } from "../../../shared/lib/fileTreeHelpers";
import { createLogger } from "../../../shared/lib/logger";
import { SystemField } from "../../../shared/lib/noteTypes";
import { iconAccentClass } from "../../../shared/lib/platform";
import {
  findFolderNote,
  toggleNoteSpace,
} from "../../../shared/lib/spaceAssignment";
import { hapticImpact } from "../../lib/haptics";
import { BottomSheet } from "./BottomSheet";

const log = createLogger("MobileContextMenu");

/**
 * Étapes à saisie du menu contextuel mobile (renommage, affectation d'espaces).
 * Les actions immédiates sont dans le menu lui-même (cf. RowContextMenu) ;
 * seules celles qui demandent une interaction supplémentaire arrivent ici.
 */
export function MobileContextMenu() {
  const [target, setTarget] = useAtom(mobileContextMenuAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const store = useStore();
  const { handleRename } = useNote();

  const [renameValue, setRenameValue] = useState("");

  const notesById = useAtomValue(notesByIdAtom);
  const tree = useAtomValue(treeAtom);

  // Amorce le champ à l'ouverture (et pas au rendu, qui se répète à chaque frappe).
  useEffect(() => {
    if (target?.step === "rename") setRenameValue(target.name);
  }, [target]);

  if (!target) return null;

  const spaces = vaultConfig?.spaces ?? [];

  // Note cible pour l'assignation d'espace : note directe ou note-dossier
  const targetNote = target.isFolder
    ? findFolderNote(tree, target.id)
    : (notesById.get(target.id) ?? null);
  const currentSpaces = targetNote
    ? toArray(targetNote.frontmatter[SystemField.SPACE])
    : [];

  async function handleToggleSpace(spaceName: string) {
    if (!target) return;
    // Relit depuis le store pour éviter une closure périmée en cas de tap rapide
    const freshNote = target.isFolder
      ? findFolderNote(store.get(treeAtom), target.id)
      : (store.get(notesByIdAtom).get(target.id) ?? null);
    if (!freshNote) return;
    hapticImpact("light");
    await toggleNoteSpace(store, freshNote, spaceName);
  }

  function close() {
    setTarget(null);
    setRenameValue("");
  }

  async function handleRenameConfirm() {
    if (!target || !renameValue.trim() || renameValue === target.name) {
      close();
      return;
    }
    log.info("rename", { id: target.id, newName: renameValue });
    await handleRename(target.id, renameValue.trim(), target.isFolder);
    close();
  }

  if (target.step === "rename") {
    return (
      <BottomSheet
        onClose={close}
        title={target.isFolder ? "Renommer le dossier" : "Renommer la note"}
      >
        <form
          // Un <form> plutôt qu'un onKeyDown sur "Enter" : sur clavier virtuel mobile,
          // la touche "Entrée"/"Valider" déclenche une soumission de formulaire, pas
          // forcément un keydown "Enter" fiable.
          onSubmit={(e) => {
            e.preventDefault();
            handleRenameConfirm();
          }}
          className="px-2 pt-2 flex flex-col gap-4"
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture du rename
            autoFocus
            type="text"
            enterKeyHint="done"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 bg-gray-50 focus:outline-none focus:border-amber-400"
            placeholder={target.name}
          />
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold text-base active:bg-amber-600 transition-colors"
          >
            Renommer
          </button>
        </form>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={close} title="Espaces">
      <div className="flex flex-col divide-y divide-gray-100">
        {spaces.map((space) => {
          const checked = currentSpaces.includes(space.name);
          return (
            <button
              key={space.id}
              type="button"
              onClick={() => handleToggleSpace(space.name)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left text-base text-gray-900 active:bg-gray-50 transition-colors"
            >
              <span className="flex-1 min-w-0 truncate">
                {space.icon ? `${space.icon}  ${space.name}` : space.name}
              </span>
              {checked && (
                <span className={`${iconAccentClass} text-lg leading-none`}>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
