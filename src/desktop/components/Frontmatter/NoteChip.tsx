import { useAtomValue } from "jotai";
import { IconXCircle } from "../../../shared/components/PlatformIcon";
import type { FolderNode } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import { notesByIdAtom } from "../../../shared/lib/atoms";
import { useCmdHeld } from "../../hooks/useCmdHeld";

/**
 * NoteChip — carte compacte représentant une note (ou un dossier) liée dans
 * un champ frontmatter. Affiche le nom court et une croix pour supprimer.
 * Cmd+clic ouvre la cible dans un nouvel onglet (si noteId/folderNode fourni).
 * openOnClick : clic simple ouvre directement dans l'onglet courant (champs à
 * choix unique, non éditables au clavier — ex. __DefaultFolder__).
 * folderNode : mode dossier — ouvre (ou crée à la volée) sa note __folder__
 * plutôt que de résoudre noteId via l'index des notes.
 */
interface NoteChipProps {
  name: string;
  onRemove: () => void;
  readOnly?: boolean;
  noteId?: string;
  folderNode?: FolderNode;
  /** Mode dossier : override du calcul "introuvable" (pas de noteId à vérifier). */
  broken?: boolean;
  openOnClick?: boolean;
}

export function NoteChip({
  name,
  onRemove,
  readOnly = false,
  noteId,
  folderNode,
  broken: brokenOverride,
  openOnClick = false,
}: NoteChipProps) {
  const { handleSelectNote, handleOpenFolder } = useNote();
  const notesById = useAtomValue(notesByIdAtom);
  const cmdHeld = useCmdHeld();
  // Cible introuvable (renommée/déplacée/supprimée sans passer par le flux de
  // suppression, ou choix "ne pas nettoyer") — même convention rouge que
  // note-link-broken (éditeur) et media-broken (images).
  const broken =
    brokenOverride ?? (!folderNode && !!noteId && !notesById.has(noteId));
  const clickable = !!(folderNode || noteId) && (openOnClick || cmdHeld);

  function handleClick(e: React.MouseEvent) {
    if (folderNode) {
      if (e.metaKey) handleOpenFolder(folderNode, true);
      else if (openOnClick) handleOpenFolder(folderNode, false);
      return;
    }
    if (!noteId) return;
    const note = notesById.get(noteId);
    if (!note) return;
    if (e.metaKey) {
      handleSelectNote(note, true);
    } else if (openOnClick) {
      handleSelectNote(note, false);
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-xs font-medium group/chip ${
        broken ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <span
        className={`max-w-30 truncate ${clickable ? "cursor-pointer" : "cursor-default"}`}
        onClick={handleClick}
        title={broken ? `« ${name} » est introuvable` : undefined}
      >
        {name}
      </span>
      {!readOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Retirer ${name}`}
          className="text-gray-400 hover:text-red-400 transition-all cursor-pointer bg-transparent border-0 p-0 flex items-center"
        >
          <IconXCircle className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
