import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { KanbanKeySelector } from "../../../shared/components/KanbanKeySelector";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { useKanban } from "../../../shared/hooks/useKanban";
import { folderPathAtom, openTabIdsAtom } from "../../../shared/lib/Atoms";
import { toArray } from "../../../shared/lib/fileTreeHelpers";
import type { Frontmatter } from "../../../shared/lib/fileTreeHelpers";
import {
  BaseViewEnum,
  type BaseViewType,
  SystemField,
} from "../../../shared/lib/noteTypes";
import { MobileKanbanView } from "./KanbanView/MobileKanbanView";
import { MobileTableView } from "./TableView";

interface Props {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

export function MobileBaseView({ base, onBaseChange }: Props) {
  const { createNote } = useFileTree();
  const folderPath = useAtomValue(folderPathAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const [selectingKey, setSelectingKey] = useState(false);

  const {
    kanbanKey,
    columns,
    cards,
    availableKeys,
    initKanban,
    moveCard,
    addColumn,
    renameColumn,
  } = useKanban({ base, onBaseChange });

  const currentView =
    (base.frontmatter[SystemField.VIEW] as BaseViewType) ?? BaseViewEnum.TABLE;

  function handleViewChange(view: BaseViewType) {
    if (view === currentView) return;
    if (view === BaseViewEnum.KANBAN) {
      setSelectingKey(true);
      return;
    }
    const {
      [SystemField.KANBAN_KEY]: _k,
      [SystemField.KANBAN_COLUMNS]: _c,
      ...rest
    } = base.frontmatter;
    onBaseChange({ ...rest, [SystemField.VIEW]: BaseViewEnum.TABLE });
  }

  function handleKeySelected(key: string) {
    setSelectingKey(false);
    initKanban(key);
  }

  async function handleCreateChild() {
    const defaultFolder = base.frontmatter[SystemField.DEFAULT_FOLDER] as
      | string
      | undefined;
    const targetDir = defaultFolder || folderPath;
    if (!targetDir) return;
    const newNote = await createNote(targetDir);
    const children = toArray(base.frontmatter[SystemField.CHILDREN]);
    onBaseChange({
      ...base.frontmatter,
      [SystemField.CHILDREN]: [...children, newNote.id],
    });
    // Ouvre dans un onglet en arrière-plan sans naviguer vers la note
    setOpenTabIds([...openTabIds, newNote.id]);
  }

  if (selectingKey) {
    return (
      <KanbanKeySelector
        availableKeys={availableKeys}
        onSelect={handleKeySelected}
        onCancel={() => setSelectingKey(false)}
      />
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 sticky top-12 bg-white z-30 border-b border-gray-100">
        {/* View selector — boutons pill */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl flex-1">
          {[BaseViewEnum.TABLE, BaseViewEnum.KANBAN].map((view) => {
            const disabled =
              view === BaseViewEnum.KANBAN && availableKeys.length === 0;
            const active = currentView === view;
            return (
              <button
                key={view}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && handleViewChange(view)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-gray-800 shadow-sm"
                    : disabled
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500"
                }`}
              >
                {view === BaseViewEnum.TABLE ? "Tableau" : "Kanban"}
              </button>
            );
          })}
        </div>

        {/* Bouton nouvelle note */}
        <button
          type="button"
          onClick={handleCreateChild}
          className="h-9 px-4 rounded-xl bg-blue-500 text-white text-sm font-medium active:bg-blue-600 transition-colors shrink-0"
        >
          + Note
        </button>
      </div>

      {currentView === BaseViewEnum.KANBAN && kanbanKey ? (
        <MobileKanbanView
          columns={columns}
          cards={cards}
          kanbanKey={kanbanKey}
          onMoveCard={moveCard}
          onRenameColumn={renameColumn}
          onAddColumn={addColumn}
        />
      ) : (
        <MobileTableView base={base} onBaseChange={onBaseChange} />
      )}
    </div>
  );
}
