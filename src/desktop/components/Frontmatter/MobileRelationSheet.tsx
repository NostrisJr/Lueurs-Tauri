import { useAtomValue } from "jotai";
import { useRef, useState } from "react";
import { BottomSheet } from "../../../mobile/components/BottomSheet/BottomSheet";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { allFoldersAtom, folderPathAtom } from "../../../shared/lib/atoms";
import { FolderSelector } from "./FolderSelector";
import { NoteChip } from "./NoteChip";
import { NoteSelector } from "./NoteSelector";
import { SpaceSelector } from "./SpaceSelector";
import {
  type Row,
  SELECTOR_PLACEHOLDERS,
  hasFolderSelector,
  hasSpaceSelector,
} from "./lib/frontmatterUtils";

interface Props {
  row: Row;
  canDelete: boolean;
  noteName: (path: string) => string;
  getCandidates: () => NoteFile[];
  addNote: (notePath: string) => void;
  removeNote: (notePath: string) => void;
  selectFolder: (absolutePath: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Bottom sheet mobile unique pour une propriété de relation (__Space__,
 * __DefaultFolder__, __Template__, __Base__, __Children__) — remplace le
 * bouton "+" (NoteSelector/SpaceSelector/FolderSelector déclenché depuis la
 * ligne) et la croix directe sur chaque NoteChip du frontmatter, cf.
 * FrontmatterValue (hideRemoveButton sur mobile). Jamais de champ de
 * renommage ici : ce sont des clés système, jamais renommables — cf.
 * MobilePropertySheet pour les propriétés libres Texte/Nombre/Bouton.
 */
export function MobileRelationSheet({
  row,
  canDelete,
  noteName,
  getCandidates,
  addNote,
  removeNote,
  selectFolder,
  onDelete,
  onClose,
}: Props) {
  const folderPath = useAtomValue(folderPathAtom);
  const allFolders = useAtomValue(allFoldersAtom);
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const isFolderField = hasFolderSelector(row.key);
  const isSpaceField = hasSpaceSelector(row.key);
  const paths = row.isNoteArray ? (row.value as string[]) : [];
  const singlePath = row.isNoteArray ? "" : (row.value as string);

  const isRoot = isFolderField && !!folderPath && singlePath === folderPath;
  const folderNode = isRoot
    ? undefined
    : allFolders.find((f) => f.id === singlePath);

  return (
    <BottomSheet autoHeight onClose={onClose}>
      <div className="px-4 pb-4 flex flex-col gap-3">
        <p className="font-semibold px-1">{row.key.replace(/^__|__$/g, "")}</p>

        <div className="flex flex-wrap gap-2">
          {isFolderField ? (
            singlePath ? (
              <NoteChip
                size="lg"
                name={
                  isRoot
                    ? "Racine du vault"
                    : (folderNode?.name ?? noteName(singlePath))
                }
                folderNode={folderNode}
                broken={!isRoot && !folderNode}
                onRemove={() => selectFolder("")}
              />
            ) : (
              <span className="text-gray-300 italic text-sm px-1">
                aucun dossier
              </span>
            )
          ) : paths.length === 0 ? (
            <span className="text-gray-300 italic text-sm px-1">
              {isSpaceField ? "aucun espace" : "aucune note"}
            </span>
          ) : (
            paths.map((path) =>
              isSpaceField ? (
                <NoteChip
                  key={path}
                  size="lg"
                  name={path}
                  onRemove={() => removeNote(path)}
                />
              ) : (
                <NoteChip
                  key={path}
                  size="lg"
                  name={noteName(path)}
                  noteId={path}
                  onRemove={() => removeNote(path)}
                />
              )
            )
          )}
        </div>

        <button
          ref={anchorRef}
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full px-3 py-2.5 rounded-xl text-gray-600 bg-gray-100 active:bg-gray-200 font-medium transition-colors"
        >
          {isFolderField ? "Changer de dossier..." : "Ajouter..."}
        </button>

        {pickerOpen && isFolderField && (
          <FolderSelector
            onSelect={(path) => {
              selectFolder(path);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
            anchorRef={anchorRef}
          />
        )}
        {pickerOpen && isSpaceField && (
          <SpaceSelector
            currentSpaces={paths}
            onSelect={(spaceName) => {
              addNote(spaceName);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
            anchorRef={anchorRef}
          />
        )}
        {pickerOpen && !isFolderField && !isSpaceField && (
          <NoteSelector
            notes={getCandidates()}
            onSelect={(note) => {
              addNote(note.id);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
            anchorRef={anchorRef}
            placeholder={
              SELECTOR_PLACEHOLDERS[row.key] ?? "Rechercher une note..."
            }
          />
        )}

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-full px-3 py-2.5 rounded-xl text-red-500 bg-red-50 active:bg-red-100 font-medium transition-colors"
          >
            Supprimer la propriété
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
