import clsx from "clsx";
import { useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { NodeIconProvider } from "../../../../shared/components/NodeIconProvider";
import { IconLock } from "../../../../shared/components/PlatformIcon";
import { Squircle } from "../../../../shared/components/Squircle";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import { useNote } from "../../../../shared/hooks/useNote";
import { navigateToNoteAtom } from "../../../../shared/lib/atoms";
import { isNoteReadOnly } from "../../../../shared/lib/noteTypes";
import { useKeyboard } from "../../../hooks/useKeyboard";
import { MarkdownPreview } from "../../FileTree/MarkdownPreview";
import { parsePreviewBlocks } from "../../FileTree/parseMarkdownPreview";
import { useMobileCardDrag } from "./useMobileCardDrag";

interface Props {
  note: NoteFile;
  /** La carte source pendant son propre drag — reste en place, estompée. */
  isDragging?: boolean;
  onDragStart: (noteId: string, x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  onDragCancel: () => void;
}

/**
 * Carte fantôme suivant le doigt pendant un drag — visuel seul, sans geste ni
 * édition, pour ne pas réarmer inutilement useMobileCardDrag sous le doigt.
 */
export function MobileKanbanCardGhost({ note }: { note: NoteFile }) {
  const blocks = useMemo(() => parsePreviewBlocks(note.body, 6), [note.body]);

  return (
    <Squircle
      radius={16}
      className={clsx("w-full px-3.5 py-3 shadow-xl", "bg-surface")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <NodeIconProvider node={note} className="text-ink-4 shrink-0 size-4" />
        <p
          className={clsx(
            "flex-1 min-w-0 text-base font-semibold truncate",
            "text-ink"
          )}
        >
          {note.name}
        </p>
        {isNoteReadOnly(note.frontmatter) && (
          <IconLock className="text-ink-4 shrink-0 size-3.5" />
        )}
      </div>
      {blocks.length > 0 && (
        <MarkdownPreview
          blocks={blocks}
          className={clsx(
            "mt-1 text-sm leading-relaxed line-clamp-2",
            "text-ink-4"
          )}
        />
      )}
    </Squircle>
  );
}

export function MobileKanbanCard({
  note,
  isDragging = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: Props) {
  const { handleRename } = useNote();
  const navigateToNote = useSetAtom(navigateToNoteAtom);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isOpen: isKeyboardOpen } = useKeyboard();
  const blocks = useMemo(() => parsePreviewBlocks(note.body, 6), [note.body]);

  const { armProps, bind, style } = useMobileCardDrag({
    onDragStart: (x, y) => onDragStart(note.id, x, y),
    onDragMove,
    onDragEnd,
    onDragCancel,
  });

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(note.name);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Ramène le titre en édition au-dessus du clavier une fois qu'il a fini de
  // s'ouvrir : le board scrolle aussi horizontalement, on ne peut pas compter
  // sur le comportement natif de WebKit pour "juste" scroller la page.
  useEffect(() => {
    if (editing && isKeyboardOpen) {
      inputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [editing, isKeyboardOpen]);

  function commitEdit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.name) {
      handleRename(note.id, trimmed, false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(note.name);
    }
  }

  return (
    <div {...armProps}>
      <div {...bind()} style={style}>
        <Squircle
          radius={16}
          className={clsx(
            "w-full bg-surface px-3.5 py-3 transition-opacity",
            isDragging ? "opacity-30" : "opacity-100"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <NodeIconProvider
              node={note}
              className="text-ink-4 shrink-0 size-4"
            />
            {editing ? (
              <input
                ref={inputRef}
                // biome-ignore lint/a11y/noAutofocus: focus intentionnel
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ fontSize: 16 }}
                className={clsx(
                  "flex-1 min-w-0 bg-transparent outline-none text-base font-semibold",
                  "text-ink"
                )}
              />
            ) : (
              <p
                className={clsx(
                  "flex-1 min-w-0 text-base font-semibold truncate",
                  "text-ink"
                )}
                onDoubleClick={startEdit}
              >
                {note.name}
              </p>
            )}
            {isNoteReadOnly(note.frontmatter) && (
              <IconLock className="text-ink-4 shrink-0 size-3.5" />
            )}
          </div>

          {blocks.length > 0 && (
            <MarkdownPreview
              blocks={blocks}
              className={clsx(
                "mt-1 text-sm leading-relaxed line-clamp-2",
                "text-ink-4"
              )}
            />
          )}

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              navigateToNote(note.id);
            }}
            className={clsx(
              "mt-2 text-xs transition-colors",
              "text-info",
              "active:text-link"
            )}
          >
            Ouvrir →
          </button>
        </Squircle>
      </div>
    </div>
  );
}
