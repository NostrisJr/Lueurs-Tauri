import clsx from "clsx";
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
    deleteCard,
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
          bg-surface opaque obligatoire : sans fond, les lignes passent au travers. */}
      <div className="sticky z-30 bg-surface" style={{ top: BASE_STICKY_TOP }}>
        <div
          className={clsx(
            "flex items-center gap-3 px-4 py-3 border-b",
            "border-line"
          )}
        >
          {/* View selector — boutons pill */}
          <div
            className={clsx(
              "flex items-center gap-1 p-1 rounded-xl flex-1",
              "bg-surface-3"
            )}
          >
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
                  className={clsx(
                    "flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-surface text-ink shadow-sm"
                      : disabled
                        ? "text-ink-5 cursor-not-allowed"
                        : "text-ink-3"
                  )}
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
            className={clsx(
              "h-9 px-4 rounded-xl text-sm font-medium transition-colors shrink-0",
              "bg-info text-on-inverse",
              "active:bg-info"
            )}
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
          onDeleteCard={deleteCard}
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
