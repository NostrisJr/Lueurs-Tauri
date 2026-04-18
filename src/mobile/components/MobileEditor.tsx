import { useRef, useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  activeNoteAtom,
  openTabIdsAtom,
  mobileViewAtom,
  activeNoteIdAtom,
  noteBackStackAtom,
  dictaphoneModeAtom,
  pendingAudioInsertAtom,
  displayModeAtom,
  type DisplayMode,
} from "../../shared/lib/Atoms";
import {
  NoteEditor,
  type EditorHandle,
} from "../../shared/components/NoteEditor/NoteEditor";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { sfChevronLeft, sfRectangleStack, sfMicrophoneFill } from "@bradleyhodges/sfsymbols";
import { useMobileSwipeBack } from "../hooks/useMobileSwipeBack";
import { DISPLAY_MODES } from "../../shared/lib/displayModes";
import { NoteType } from "../../shared/lib/noteTypes";

export function MobileEditor() {
  const activeNote = useAtomValue(activeNoteAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const noteBackStack = useAtomValue(noteBackStackAtom);
  const setMobileView = useSetAtom(mobileViewAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);
  const [pendingAudioInsert, setPendingAudioInsert] = useAtom(pendingAudioInsertAtom);
  const [displayMode, setDisplayMode] = useAtom(displayModeAtom);
  const displayModeHandlerRef = useRef<((mode: DisplayMode) => void) | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const isBase = activeNote?.type === NoteType.BASE;

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
  }, [activeNote]);

  // Consomme le bloc audio en attente après retour du dictaphone (insert-mode)
  useEffect(() => {
    if (!pendingAudioInsert || !editorRef.current) return;
    editorRef.current.insertAudioBlock(
      pendingAudioInsert.path,
      pendingAudioInsert.title
    );
    setPendingAudioInsert(null);
  }, [pendingAudioInsert, setPendingAudioInsert]);

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
      className="flex flex-col h-full w-full fixed bg-white"
      style={{
        transform:
          swipeTranslate > 0 ? `translateX(${swipeTranslate}px)` : undefined,
        transition: isTransitioning ? "transform 0.2s ease-out" : undefined,
      }}
      onTouchStart={touchHandlers.onTouchStart}
      onTouchMove={touchHandlers.onTouchMove}
      onTouchEnd={touchHandlers.onTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center w-full justify-between px-2 py-2 border-b bg-white border-gray-100 fixed top-0 pt-12 z-30">
        <button
          type="button"
          onClick={() => {
            setNoteBackStack([]);
            setMobileView("filetree");
          }}
          className="flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-500 active:bg-gray-100 transition-colors"
        >
          <SFIcon icon={sfChevronLeft} className="size-4" />
          <span className="text-base">Notes</span>
        </button>

        <div className="flex-1 flex justify-end items-center gap-1">
          {!isBase && (() => {
            const currentEntry = DISPLAY_MODES.find((m) => m.value === displayMode) ?? DISPLAY_MODES[0];
            const nextEntry = DISPLAY_MODES.find((m) => m.value !== displayMode) ?? DISPLAY_MODES[1];
            return (
              <button
                type="button"
                onClick={() => {
                  const next: DisplayMode = nextEntry.value;
                  setDisplayMode(next);
                  displayModeHandlerRef.current?.(next);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
                title={currentEntry.label}
              >
                <SFIcon icon={currentEntry.icon} className="size-5" />
              </button>
            );
          })()}
          <button
            type="button"
            onClick={() => {
              setDictaphoneMode("insert");
              setMobileView("dictaphone");
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
            title="Ajouter un enregistrement"
          >
            <SFIcon icon={sfMicrophoneFill} className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileView("tabs")}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
          >
            <SFIcon icon={sfRectangleStack} className="size-5" />
            {openTabIds.length > 1 && (
              <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {openTabIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Éditeur */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto overscroll-none mobile-prose pt-23"
        data-scrollable
        onScroll={handleScroll}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <NoteEditor
          ref={editorRef}
          defaultCollapsedFrontmatter
          hideDisplayModeSelector
          displayModeHandlerRef={displayModeHandlerRef}
        />
      </div>
    </div>
  );
}
