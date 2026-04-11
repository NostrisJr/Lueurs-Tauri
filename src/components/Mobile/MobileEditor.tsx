import { useRef, useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  activeNoteAtom,
  openTabIdsAtom,
  mobileViewAtom,
  activeNoteIdAtom,
  noteBackStackAtom,
} from "../../lib/atoms.ts";
import { NoteEditor, type EditorHandle } from "../NoteEditor/NoteEditor.tsx";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfChevronLeft,
  sfRectangleStack,
  sfEllipsis,
} from "@bradleyhodges/sfsymbols";
import { useMobileSwipeBack } from "../../hooks/mobile/useMobileSwipeBack";

export function MobileEditor() {
  const activeNote = useAtomValue(activeNoteAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const noteBackStack = useAtomValue(noteBackStackAtom);
  const setMobileView = useSetAtom(mobileViewAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const editorRef = useRef<EditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());

  const handleScroll = useCallback(() => {
    if (activeNote && scrollContainerRef.current) {
      scrollPositions.current.set(
        activeNote.id,
        scrollContainerRef.current.scrollTop
      );
    }
  }, [activeNote]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeNote) return;
    const saved = scrollPositions.current.get(activeNote.id) ?? 0;
    const raf = requestAnimationFrame(() => {
      container.scrollTop = saved;
    });
    return () => cancelAnimationFrame(raf);
  }, [activeNote?.id]);

  const handleBack = useCallback(() => {
    if (noteBackStack.length > 0) {
      const prev = noteBackStack[noteBackStack.length - 1];
      setNoteBackStack((s) => s.slice(0, -1));
      setActiveNoteId(prev);
    } else {
      setMobileView("filetree");
    }
  }, [noteBackStack, setNoteBackStack, setActiveNoteId, setMobileView]);

  const { swipeTranslate, isTransitioning, touchHandlers } =
    useMobileSwipeBack(handleBack);

  if (!activeNote) return null;

  return (
    <div
      className="flex flex-col h-screen bg-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        transform:
          swipeTranslate > 0 ? `translateX(${swipeTranslate}px)` : undefined,
        transition: isTransitioning ? "transform 0.2s ease-out" : undefined,
      }}
      onTouchStart={touchHandlers.onTouchStart}
      onTouchMove={touchHandlers.onTouchMove}
      onTouchEnd={touchHandlers.onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => {
            setNoteBackStack([]);
            setMobileView("filetree");
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-blue-500 active:bg-gray-100 transition-colors"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
          <span className="text-base">Notes</span>
        </button>

        <h1 className="text-base font-semibold text-gray-800 truncate max-w-40">
          {activeNote.name}
        </h1>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMobileView("tabs")}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-blue-500 active:bg-gray-100 transition-colors"
          >
            <SFIcon icon={sfRectangleStack} className="size-5" />
            {openTabIds.length > 1 && (
              <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {openTabIds.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100 transition-colors"
          >
            <SFIcon icon={sfEllipsis} className="size-5" />
          </button>
        </div>
      </div>

      {/* Éditeur */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto mobile-prose"
        data-scrollable
        onScroll={handleScroll}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <NoteEditor ref={editorRef} defaultCollapsedFrontmatter />
      </div>
    </div>
  );
}
