import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef, useState } from "react";
import { KanbanKeySelector } from "../../../shared/components/KanbanKeySelector";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { useKanban } from "../../../shared/hooks/useKanban";
import { useTable } from "../../../shared/hooks/useTable";
import { folderPathAtom, openTabIdsAtom } from "../../../shared/lib/atoms";
import { toArray } from "../../../shared/lib/fileTreeHelpers";
import type { Frontmatter } from "../../../shared/lib/fileTreeHelpers";
import {
  BaseViewEnum,
  type BaseViewType,
  SystemField,
} from "../../../shared/lib/noteTypes";
import { MobileKanbanView } from "./KanbanView/MobileKanbanView";
import { MobileTableView } from "./TableView";
import { MobileTableHeader } from "./TableView/MobileTableHeader";
import { BASE_STICKY_TOP } from "./constants";

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

  const table = useTable({ base, onBaseChange });

  // L'en-tête de colonnes vit dans le même bloc sticky que la barre ci-dessous
  // (un seul élément collant, donc aucun calcul d'offset entre les deux), mais
  // hors du scroller horizontal des lignes : on lui recopie son scrollLeft.
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncHeaderScroll = useCallback((scrollLeft: number) => {
    const el = headerScrollRef.current;
    if (el) el.scrollLeft = scrollLeft;
  }, []);

  const {
    kanbanKey,
    columns,
    cards,
    availableKeys,
    initKanban,
    moveCard,
    addColumn,
    renameColumn,
    removeColumn,
    setColumnColor,
    isEnumKey,
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

  const showKanban = currentView === BaseViewEnum.KANBAN && !!kanbanKey;

  return (
    <div className="flex flex-col w-full">
      {/* Bloc collant : barre de vue + en-tête de colonnes du tableau. Les deux
          dans un seul élément sticky — empiler deux sticky indépendants oblige
          à calculer un offset entre eux, et celui du tableau, enfermé dans le
          scroller horizontal des lignes, ne collerait de toute façon jamais.
          bg-white opaque obligatoire : sans fond, les lignes passent au travers. */}
      <div className="sticky z-30 bg-white" style={{ top: BASE_STICKY_TOP }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
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

        {!showKanban && table.childNotes.length > 0 && (
          <MobileTableHeader
            columns={table.columns}
            scrollRef={headerScrollRef}
          />
        )}
      </div>

      {showKanban ? (
        <MobileKanbanView
          columns={columns}
          cards={cards}
          onMoveCard={moveCard}
          onRenameColumn={renameColumn}
          onAddColumn={addColumn}
          onDeleteColumn={removeColumn}
          onSetColumnColor={isEnumKey ? setColumnColor : undefined}
        />
      ) : (
        <MobileTableView table={table} onBodyScroll={syncHeaderScroll} />
      )}
    </div>
  );
}
