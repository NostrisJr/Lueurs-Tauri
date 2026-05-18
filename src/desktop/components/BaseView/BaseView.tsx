import { IconPlusCircle } from "../../../shared/components/PlatformIcon";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { KanbanKeySelector } from "../../../shared/components/KanbanKeySelector";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { useKanban } from "../../../shared/hooks/useKanban";
import {
  activeNoteIdAtom,
  folderPathAtom,
  openTabIdsAtom,
} from "../../../shared/lib/Atoms";
import { toArray } from "../../../shared/lib/fileTreeHelpers";
import type { Frontmatter } from "../../../shared/lib/fileTreeHelpers";
import { createLogger } from "../../../shared/lib/logger";
import {
  BaseViewEnum,
  type BaseViewType,
  SystemField,
} from "../../../shared/lib/noteTypes";
import { KanbanView } from "./KanbanView/KanbanView";
import { TableView } from "./TableView/TableView";
import { ViewSelector } from "./ViewSelector";

const log = createLogger("BaseView");

interface Props {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

export function BaseView({ base, onBaseChange }: Props) {
  const { createNote } = useFileTree();
  const folderPath = useAtomValue(folderPathAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
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

  // Tableau est la vue par défaut
  const currentView =
    (base.frontmatter[SystemField.VIEW] as BaseViewType) ?? BaseViewEnum.TABLE;

  function handleViewChange(view: BaseViewType) {
    if (view === currentView) return;

    log.info("changement de vue", { baseId: base.id, view });

    if (view === BaseViewEnum.KANBAN) {
      setSelectingKey(true);
      return;
    }

    if (view === BaseViewEnum.TABLE) {
      // Supprimer les champs Kanban et passer en vue tableau
      const {
        [SystemField.KANBAN_KEY]: _k,
        [SystemField.KANBAN_COLUMNS]: _c,
        ...rest
      } = base.frontmatter;
      onBaseChange({ ...rest, [SystemField.VIEW]: BaseViewEnum.TABLE });
    }
  }

  function handleKeySelected(key: string) {
    log.info("clé kanban sélectionnée", { baseId: base.id, key });
    setSelectingKey(false);
    initKanban(key);
  }

  async function handleCreateChild(e: React.MouseEvent) {
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
    setOpenTabIds([...openTabIds, newNote.id]);
    if (e.metaKey) setActiveNoteId(newNote.id);
    log.info("note enfant créée depuis la base", {
      baseId: base.id,
      noteId: newNote.id,
      targetDir,
    });
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center gap-3 px-4 py-2 sticky top-12 bg-white z-30">
        <ViewSelector
          currentView={currentView}
          kanbanAvailable={availableKeys.length > 0}
          onChange={handleViewChange}
        />
        {currentView === BaseViewEnum.KANBAN && kanbanKey && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectingKey(true);
            }}
            className="font-body text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            title="Changer la propriété de groupement"
          >
            Groupé par{" "}
            <span className="text-gray-600 underline underline-offset-2">
              {kanbanKey}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => handleCreateChild(e)}
          className="flex items-center gap-1 font-body text-xs text-gray-400 hover:text-amber-500 transition-colors cursor-pointer"
          title="Nouvelle note dans la base"
        >
          <IconPlusCircle className="size-3.5" />
          <span>Nouvelle note</span>
        </button>
      </div>

      <div className="">
        {selectingKey ? (
          <KanbanKeySelector
            availableKeys={availableKeys}
            onSelect={handleKeySelected}
            onCancel={() => setSelectingKey(false)}
          />
        ) : currentView === BaseViewEnum.KANBAN && kanbanKey ? (
          <KanbanView
            columns={columns}
            cards={cards}
            kanbanKey={kanbanKey}
            onMoveCard={moveCard}
            onRenameColumn={renameColumn}
            onAddColumn={addColumn}
          />
        ) : (
          <TableView base={base} onBaseChange={onBaseChange} />
        )}
      </div>
    </div>
  );
}
