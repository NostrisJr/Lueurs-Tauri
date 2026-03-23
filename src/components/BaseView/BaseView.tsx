import { useState } from "react";
import { useSetAtom } from "jotai";
import { activeNoteIdAtom } from "../../lib/atoms";
import {
  BaseViewEnum,
  SystemField,
  type BaseViewType,
} from "../../lib/noteTypes";
import type { NoteFile } from "../FileTree/hooks/useFileTree";
import type { Frontmatter } from "../FileTree/lib/fileTreeHelpers";
import { useKanban } from "./hooks/useKanban";
import { KanbanKeySelector } from "./KanbanView/KanbanKeySelector";
import { KanbanView } from "./KanbanView/KanbanView";
import { TableView } from "./TableView/TableView";
import { ViewSelector } from "./ViewSelector";
import { createLogger } from "../../lib/logger";

const log = createLogger("BaseView");

interface Props {
  base: NoteFile;
  onBaseChange: (frontmatter: Frontmatter) => void;
}

export function BaseView({ base, onBaseChange }: Props) {
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

  // TODO: ouvrir dans un onglet dédié (feature onglets à venir)
  function handleCardClick(note: NoteFile) {
    log.info("clic carte kanban", { noteId: note.id });
    setActiveNoteId(note.id);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
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
      </div>

      <div className="flex-1 overflow-hidden">
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
            onCardClick={handleCardClick}
          />
        ) : (
          <TableView base={base} onBaseChange={onBaseChange} />
        )}
      </div>
    </div>
  );
}
