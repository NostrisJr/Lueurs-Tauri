import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { useNodeMenuActions } from "../../../mobile/components/FileTree/useNodeMenuActions";
import { NodePreviewCard } from "../../../mobile/components/Row";
import { RowContextMenu } from "../../../mobile/components/Row/RowContextMenu";
import { useLongPress } from "../../../mobile/hooks/useLongPress";
import { hapticImpact } from "../../../mobile/lib/haptics";
import { IconXCircle } from "../../../shared/components/PlatformIcon";
import type { FolderNode } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import { navigateToNoteAtom, notesByIdAtom } from "../../../shared/lib/atoms";
import { isMobile } from "../../../shared/lib/platform";
import { useCmdHeld } from "../../hooks/useCmdHeld";

/**
 * NoteChip — carte compacte représentant une note (ou un dossier) liée dans
 * un champ frontmatter. Affiche le nom court et, sur desktop, une croix pour
 * supprimer directement (cmd+clic ouvre la cible dans un nouvel onglet).
 * openOnClick : clic simple ouvre directement dans l'onglet courant (champs à
 * choix unique, non éditables au clavier — ex. __DefaultFolder__).
 * folderNode : mode dossier — ouvre (ou crée à la volée) sa note __folder__
 * plutôt que de résoudre noteId via l'index des notes.
 *
 * Sur mobile, la croix n'est jamais affichée directement dans le frontmatter
 * (suppression réservée à MobileRelationSheet, cf. hideRemoveButton) ; le tap
 * court n'a plus d'effet, un appui long ouvre le même menu contextuel que
 * dans le file tree (aperçu, Ouvrir, Renommer, Partager...).
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
  /** Mobile : masque la croix même si !readOnly (suppression via la sheet uniquement). */
  hideRemoveButton?: boolean;
  /** "lg" : présentation plus grande/ergonomique, pour MobileRelationSheet. */
  size?: "sm" | "lg";
}

export function NoteChip({
  name,
  onRemove,
  readOnly = false,
  noteId,
  folderNode,
  broken: brokenOverride,
  openOnClick = false,
  hideRemoveButton = false,
  size = "sm",
}: NoteChipProps) {
  const { handleSelectNote, handleOpenFolder } = useNote();
  const notesById = useAtomValue(notesByIdAtom);
  const navigateToNote = useSetAtom(navigateToNoteAtom);
  const cmdHeld = useCmdHeld();
  const buildMenuActions = useNodeMenuActions();
  const chipRef = useRef<HTMLSpanElement>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  // Cible introuvable (renommée/déplacée/supprimée sans passer par le flux de
  // suppression, ou choix "ne pas nettoyer") — même convention rouge que
  // note-link-broken (éditeur) et media-broken (images).
  const broken =
    brokenOverride ?? (!folderNode && !!noteId && !notesById.has(noteId));
  const node = folderNode ?? (noteId ? notesById.get(noteId) : undefined);
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

  // Navigation chaînée (reste dans le même onglet, empile la note courante —
  // cf. navigateToNoteAtom/popNoteBackAtom) plutôt que handleSelectNote :
  // ouvrir une note depuis une chip n'est pas une "ouverture fraîche" depuis
  // le file tree.
  function openNote() {
    if (folderNode) {
      handleOpenFolder(folderNode, false);
      return;
    }
    if (noteId) navigateToNote(noteId);
  }

  const longPress = useLongPress(
    () => {
      if (!node) return;
      hapticImpact("heavy");
      setMenuRect(chipRef.current?.getBoundingClientRect() ?? null);
    },
    () => {}
  );

  const nameSizeClass = size === "lg" ? "max-w-48 text-sm" : "max-w-30";

  return (
    <span
      ref={chipRef}
      className={clsx(
        "inline-flex items-center gap-2 rounded-md font-medium group/chip",
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs",
        broken ? "bg-danger-soft text-danger-strong" : "bg-surface-3 text-ink-2"
      )}
    >
      <span
        className={clsx(
          "truncate",
          nameSizeClass,
          isMobile
            ? "cursor-default"
            : clickable
              ? "cursor-pointer"
              : "cursor-default"
        )}
        title={broken ? `« ${name} » est introuvable` : undefined}
        {...(isMobile ? longPress : { onClick: handleClick })}
      >
        {name}
      </span>
      {!readOnly && !hideRemoveButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Retirer ${name}`}
          className={clsx(
            "transition-all cursor-pointer bg-transparent border-0 p-0 flex items-center",
            "text-ink-4",
            "hover:text-danger-2"
          )}
        >
          <IconXCircle
            className={size === "lg" ? "size-4" : "size-3"}
            aria-hidden="true"
          />
        </button>
      )}

      {isMobile && node && menuRect && (
        <RowContextMenu
          rect={menuRect}
          config={{
            preview: <NodePreviewCard node={node} />,
            ...buildMenuActions(node, openNote),
          }}
          phase="open"
          dragPoint={null}
          onDismiss={() => setMenuRect(null)}
          onActivate={() => {
            setMenuRect(null);
            openNote();
          }}
          onDragBegin={() => {}}
          onDragUpdate={() => {}}
          onDragFinish={() => {}}
        />
      )}
    </span>
  );
}
