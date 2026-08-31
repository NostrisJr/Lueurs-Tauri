import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import {
  type KanbanCards,
  NO_VALUE_COLUMN_ID,
} from "../../../../shared/lib/atoms";
import type { KanbanColumn as KanbanColumnType } from "../../../../shared/lib/noteTypes";
import { startDragAutoscroll } from "../../../lib/dragAutoscroll";
import { MobileKanbanCardGhost } from "./MobileKanbanCard";
import { MobileKanbanColumn } from "./MobileKanbanColumn";

interface Props {
  columns: KanbanColumnType[];
  cards: KanbanCards;
  onMoveCard: (
    noteId: string,
    fromColId: string,
    toColId: string
  ) => Promise<void>;
  onRenameColumn: (colId: string, newLabel: string) => Promise<void>;
  onAddColumn: (label: string) => void;
  onDeleteColumn: (colId: string) => void;
  // Défini uniquement pour une clé BUTTON → pastille couleur cliquable
  onSetColumnColor?: (colId: string, color: string | undefined) => void;
}

interface DragState {
  noteId: string;
  fromColId: string;
  note: NoteFile;
}

export function MobileKanbanView({
  columns,
  cards,
  onMoveCard,
  onRenameColumn,
  onAddColumn,
  onDeleteColumn,
  onSetColumnColor,
}: Props) {
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  // ── Déplacement d'une carte (appui long) ──────────────────────────────
  const boardRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null);
  const [ghostPoint, setGhostPoint] = useState({ x: 0, y: 0 });
  const pointRef = useRef({ x: 0, y: 0 });
  const stopBoardScrollRef = useRef<(() => void) | null>(null);
  const stopPageScrollRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      stopBoardScrollRef.current?.();
      stopPageScrollRef.current?.();
    },
    []
  );

  function findColumnOfNote(noteId: string): string | null {
    for (const [colId, notes] of Object.entries(cards)) {
      if (notes.some((n) => n.id === noteId)) return colId;
    }
    return null;
  }

  function findNote(noteId: string): NoteFile | null {
    for (const notes of Object.values(cards)) {
      const found = notes.find((n) => n.id === noteId);
      if (found) return found;
    }
    return null;
  }

  // `elementsFromPoint` (pluriel) et non `elementFromPoint` : le fantôme qui
  // suit le doigt est au-dessus du board, on traverse donc toute la pile
  // jusqu'à la première colonne plutôt que de compter sur un `pointer-events:
  // none` toujours fiable en plein geste (cf. MobileFileTree).
  const findDropTarget = useCallback((x: number, y: number): string | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const id = el.closest<HTMLElement>("[data-dropzone-column]")?.dataset
        .dropzoneColumn;
      if (id) return id;
    }
    return null;
  }, []);

  function handleCardDragStart(noteId: string, x: number, y: number) {
    const fromColId = findColumnOfNote(noteId);
    const note = findNote(noteId);
    if (!fromColId || !note) return;
    setDragState({ noteId, fromColId, note });
    pointRef.current = { x, y };
    setGhostPoint({ x, y });
    setDropTargetColId(findDropTarget(x, y));

    stopBoardScrollRef.current?.();
    stopPageScrollRef.current?.();
    // Deux axes indépendants : le board scrolle horizontalement (changer de
    // colonne), la page (posée par MobileEditor) scrolle verticalement.
    stopBoardScrollRef.current = startDragAutoscroll({
      container: () => boardRef.current,
      point: () => pointRef.current,
      axis: "x",
      onScroll: (px, py) => setDropTargetColId(findDropTarget(px, py)),
    });
    stopPageScrollRef.current = startDragAutoscroll({
      container: () =>
        boardRef.current?.closest<HTMLElement>("[data-scrollable]") ?? null,
      point: () => pointRef.current,
      axis: "y",
      onScroll: (px, py) => setDropTargetColId(findDropTarget(px, py)),
    });
  }

  function handleCardDragMove(x: number, y: number) {
    pointRef.current = { x, y };
    setGhostPoint({ x, y });
    setDropTargetColId(findDropTarget(x, y));
  }

  function resetDrag() {
    stopBoardScrollRef.current?.();
    stopBoardScrollRef.current = null;
    stopPageScrollRef.current?.();
    stopPageScrollRef.current = null;
    setDragState(null);
    setDropTargetColId(null);
  }

  function handleCardDragEnd(x: number, y: number) {
    // Recalculé sur les coordonnées finales : le dernier `move` peut dater
    // d'un peu avant le lâcher (notamment pendant l'autoscroll, où le doigt
    // est immobile).
    const target = findDropTarget(x, y);
    const source = dragState;
    resetDrag();
    if (!source || !target || target === source.fromColId) return;
    onMoveCard(source.noteId, source.fromColId, target);
  }

  function commitAddColumn() {
    const trimmed = newColumnLabel.trim();
    if (trimmed) onAddColumn(trimmed);
    setNewColumnLabel("");
    setAddingColumn(false);
  }

  const columnDragProps = {
    draggingNoteId: dragState?.noteId ?? null,
    onCardDragStart: handleCardDragStart,
    onCardDragMove: handleCardDragMove,
    onCardDragEnd: handleCardDragEnd,
    onCardDragCancel: resetDrag,
  };

  return (
    <div className="relative h-full">
      <div
        ref={boardRef}
        data-kanban-board=""
        className="flex gap-4 px-4 py-3 overflow-x-auto scrollbar-none h-full"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {columns.map((col) => (
          <MobileKanbanColumn
            key={col.id}
            column={col}
            notes={cards[col.id] ?? []}
            onRename={onRenameColumn}
            onDelete={onDeleteColumn}
            onSetColor={onSetColumnColor}
            isOver={dropTargetColId === col.id}
            {...columnDragProps}
          />
        ))}

        {cards[NO_VALUE_COLUMN_ID] && cards[NO_VALUE_COLUMN_ID].length > 0 && (
          <MobileKanbanColumn
            key={NO_VALUE_COLUMN_ID}
            column={{ id: NO_VALUE_COLUMN_ID, label: "Sans valeur" }}
            notes={cards[NO_VALUE_COLUMN_ID]}
            onRename={() => {}}
            onDelete={() => {}}
            virtual
            isOver={dropTargetColId === NO_VALUE_COLUMN_ID}
            {...columnDragProps}
          />
        )}

        {/* Ajout de colonne */}
        <div
          className="shrink-0 flex flex-col"
          style={{ width: "85vw", scrollSnapAlign: "start" }}
        >
          {addingColumn ? (
            <div className="bg-gray-50 rounded-2xl p-3">
              <input
                // biome-ignore lint/a11y/noAutofocus: focus intentionnel
                autoFocus
                value={newColumnLabel}
                onChange={(e) => setNewColumnLabel(e.target.value)}
                onBlur={commitAddColumn}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddColumn();
                  if (e.key === "Escape") {
                    setNewColumnLabel("");
                    setAddingColumn(false);
                  }
                }}
                placeholder="Nom de la colonne…"
                style={{ fontSize: 16 }}
                className="w-full bg-transparent outline-none text-gray-700 border-b border-gray-400 pb-1"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="text-left px-3 py-3 rounded-2xl text-base text-gray-400 active:bg-gray-50 transition-colors"
            >
              + Ajouter une colonne
            </button>
          )}
        </div>
      </div>

      {/* Carte fantôme : suit le doigt, ne participe jamais à elementsFromPoint. */}
      {dragState && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: ghostPoint.x,
            top: ghostPoint.y,
            width: "calc(85vw - 2rem)",
            transform: "translate(-50%, -50%) scale(1.04)",
          }}
        >
          <MobileKanbanCardGhost note={dragState.note} />
        </div>
      )}
    </div>
  );
}
