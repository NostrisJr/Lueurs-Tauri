import clsx from "clsx";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import { useKanbanEdgeScroll } from "../../../../shared/hooks/useKanbanEdgeScroll";
import {
  type KanbanCards,
  NO_VALUE_COLUMN_ID,
  mobileCardDraggingAtom,
} from "../../../../shared/lib/atoms";
import { edgeDirection } from "../../../../shared/lib/kanbanColumnScroll";
import { KANBAN_TRASH_ID } from "../../../../shared/lib/kanbanDrop";
import type { KanbanColumn as KanbanColumnType } from "../../../../shared/lib/noteTypes";
import { startDragAutoscroll } from "../../../lib/dragAutoscroll";
import { MobileKanbanCardGhost } from "./MobileKanbanCard";
import { MobileKanbanColumn } from "./MobileKanbanColumn";
import { MobileKanbanTrashZone } from "./MobileKanbanTrashZone";

interface Props {
  columns: KanbanColumnType[];
  cards: KanbanCards;
  onMoveCard: (
    noteId: string,
    fromColId: string,
    toColId: string
  ) => Promise<void>;
  onDeleteCard: (noteId: string) => Promise<void>;
  onRenameColumn: (colId: string, newLabel: string) => Promise<void>;
  onAddColumn: (label: string) => void;
  onDeleteColumn: (colId: string) => void;
  // Défini uniquement pour une clé ENUM → pastille couleur cliquable
  onSetColumnColor?: (colId: string, color: string | undefined) => void;
}

// Largeur des bandes de bord déclenchant le passage à la colonne voisine.
const EDGE_WIDTH_PX = 56;

interface DragState {
  noteId: string;
  fromColId: string;
  note: NoteFile;
}

export function MobileKanbanView({
  columns,
  cards,
  onMoveCard,
  onDeleteCard,
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
  const stopPageScrollRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      stopPageScrollRef.current?.();
    },
    []
  );

  const setEdgeDirection = useKanbanEdgeScroll(boardRef);
  const setCardDragging = useSetAtom(mobileCardDraggingAtom);

  // Le doigt près d'un bord du board fait passer à la colonne voisine.
  function updateEdgeDirection(x: number) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setEdgeDirection(edgeDirection(x, rect.left, rect.right, EDGE_WIDTH_PX));
  }

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
      // La corbeille flotte au-dessus des colonnes : testée en premier sur
      // chaque élément traversé, sinon la colonne dessous l'emporterait.
      if (el.closest("[data-dropzone-trash]")) return KANBAN_TRASH_ID;
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
    setCardDragging(true);
    pointRef.current = { x, y };
    setGhostPoint({ x, y });
    setDropTargetColId(findDropTarget(x, y));

    updateEdgeDirection(x);

    stopPageScrollRef.current?.();
    // Seule la page (posée par MobileEditor) défile en continu, verticalement.
    // L'horizontal passe par updateEdgeDirection : le board est en
    // scroll-snap mandatory, qui ramène aussitôt en place tout défilement
    // programmatique par petits pas — il faut viser un point d'ancrage.
    stopPageScrollRef.current = startDragAutoscroll({
      container: () =>
        boardRef.current?.closest<HTMLElement>("[data-scrollable]") ?? null,
      point: () => pointRef.current,
      axis: "y",
      // `elementsFromPoint` (pluriel) : le fantôme coiffe la pile, on la
      // traverse jusqu'à la corbeille, qui recouvre la zone de défilement haute.
      paused: ({ x, y }) =>
        document
          .elementsFromPoint(x, y)
          .some((el) => el.closest("[data-no-autoscroll]")),
      onScroll: (px, py) => setDropTargetColId(findDropTarget(px, py)),
    });
  }

  function handleCardDragMove(x: number, y: number) {
    pointRef.current = { x, y };
    setGhostPoint({ x, y });
    setDropTargetColId(findDropTarget(x, y));
    updateEdgeDirection(x);
  }

  function resetDrag() {
    setCardDragging(false);
    setEdgeDirection(0);
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
    if (!source || !target) return;
    if (target === KANBAN_TRASH_ID) {
      onDeleteCard(source.noteId);
      return;
    }
    if (target === source.fromColId) return;
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
      <MobileKanbanTrashZone
        visible={dragState !== null}
        active={dropTargetColId === KANBAN_TRASH_ID}
      />
      <div
        ref={boardRef}
        data-kanban-board=""
        // relative : les colonnes mesurent leur offsetLeft depuis le board, pas
        // depuis un ancêtre positionné dont l'origine pourrait différer.
        className="relative flex gap-4 px-4 py-3 overflow-x-auto scrollbar-none h-full"
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
          style={{ width: "85vw", scrollSnapAlign: "center" }}
        >
          {addingColumn ? (
            <div className="bg-surface-2 rounded-2xl p-3">
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
                className={clsx(
                  "w-full bg-transparent outline-none border-b pb-1",
                  "text-ink-2 border-line-3"
                )}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className={clsx(
                "text-left px-3 py-3 rounded-2xl text-base transition-colors",
                "text-ink-4",
                "active:bg-surface-2"
              )}
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
