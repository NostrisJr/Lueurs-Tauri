import {
  IconArrowUturnBackward,
  IconArrowUturnForward,
  IconChevronLeft,
  IconMicrophoneFill,
  IconRectangleStack,
} from "../../../shared/components/PlatformIcon";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
  type EditorHandle,
  NoteEditor,
} from "../../../shared/components/NoteEditor/NoteEditor";
import {
  type DisplayMode,
  activeNoteAtom,
  dictaphoneModeAtom,
  displayModeAtom,
  mobileNavigateAtom,
  mobileResetNavAtom,
  noteBackStackAtom,
  openTabIdsAtom,
  pendingAudioInsertAtom,
} from "../../../shared/lib/Atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import { NoteType } from "../../../shared/lib/noteTypes";
import {
  CARET_BOTTOM_PADDING,
  MOBILE_HEADER_HEIGHT,
  MOBILE_TOOLBAR_OFFSET,
  useCaretScroll,
} from "../../../shared/hooks/useCaretScroll";

import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { hapticImpact } from "../../lib/haptics";
import { MobileFormattingBar } from "./MobileFormattingBar";

export function MobileEditor() {
  const activeNote = useAtomValue(activeNoteAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const resetNav = useSetAtom(mobileResetNavAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);
  const [pendingAudioInsert, setPendingAudioInsert] = useAtom(
    pendingAudioInsertAtom
  );
  const [displayMode, setDisplayMode] = useAtom(displayModeAtom);
  const displayModeHandlerRef = useRef<((mode: DisplayMode) => void) | null>(
    null
  );
  const editorRef = useRef<EditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const isBase = activeNote?.type === NoteType.BASE;
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  const totalMobileInset =
    keyboardHeight > 0 ? keyboardHeight + MOBILE_TOOLBAR_OFFSET : 0;
  useCaretScroll(scrollContainerRef, {
    bottomInset: totalMobileInset,
    topInset: MOBILE_HEADER_HEIGHT,
  });

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

  // Scroll instant au caret quand le clavier s'ouvre (hauteur corrigée avec la toolbar)
  useEffect(() => {
    if (keyboardHeight === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const caretRect = sel.getRangeAt(0).getBoundingClientRect();
      const visibleBottom =
        window.innerHeight -
        keyboardHeight -
        MOBILE_TOOLBAR_OFFSET -
        CARET_BOTTOM_PADDING;
      if (caretRect.bottom > visibleBottom) {
        container.scrollTop += caretRect.bottom - visibleBottom;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [keyboardHeight]);

  // Consomme le bloc audio en attente après retour du dictaphone (insert-mode)
  useEffect(() => {
    if (!pendingAudioInsert || !editorRef.current) return;
    editorRef.current.insertAudioBlock(
      pendingAudioInsert.path,
      pendingAudioInsert.title
    );
    setPendingAudioInsert(null);
  }, [pendingAudioInsert, setPendingAudioInsert]);

  if (!activeNote) return null;

  return (
    <div className="flex flex-col h-full w-full fixed bg-white">
      {/* Header */}
      <div className="flex items-center w-full justify-between px-2 py-2 border-b bg-white border-gray-100 fixed top-0 pt-12 z-30">
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            setNoteBackStack([]);
            resetNav();
          }}
          className="flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-500 active:bg-gray-100 transition-colors"
        >
          <IconChevronLeft className="size-4" />
          <span className="text-base">Notes</span>
        </button>

        <div className="flex-1 flex justify-end items-center gap-1">
          <button
            type="button"
            onClick={() => editorRef.current?.undo()}
            className="w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
            title="Annuler (⌘Z)"
          >
            <IconArrowUturnBackward className="size-4.5" />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.redo()}
            className="w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
            title="Rétablir (⌘⇧Z)"
          >
            <IconArrowUturnForward className="size-4.5" />
          </button>
          {!isBase &&
            (() => {
              const currentEntry =
                DISPLAY_MODES.find((m) => m.value === displayMode) ??
                DISPLAY_MODES[0];
              const nextEntry =
                DISPLAY_MODES.find((m) => m.value !== displayMode) ??
                DISPLAY_MODES[1];
              return (
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    const next: DisplayMode = nextEntry.value;
                    setDisplayMode(next);
                    displayModeHandlerRef.current?.(next);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
                  title={currentEntry.label}
                >
                  <currentEntry.Icon className="size-5" />
                </button>
              );
            })()}
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setDictaphoneMode("insert");
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
            title="Ajouter un enregistrement"
          >
            <IconMicrophoneFill className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              navigate("tabs");
            }}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-amber-500 active:bg-gray-100 transition-colors"
          >
            <IconRectangleStack className="size-5" />
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
        style={{
          paddingBottom:
            keyboardHeight > 0
              ? keyboardHeight + 60
              : "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <NoteEditor
          ref={editorRef}
          defaultCollapsedFrontmatter
          hideDisplayModeSelector
          displayModeHandlerRef={displayModeHandlerRef}
        />
      </div>

      <MobileFormattingBar
        editorRef={editorRef}
        keyboardHeight={keyboardHeight}
        isKeyboardOpen={isKeyboardOpen}
      />
    </div>
  );
}
