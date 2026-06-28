import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { NoteEditor } from "../../../shared/components/NoteEditor/NoteEditor";
import type { Editor } from "../../../shared/components/NoteEditor/MarkdownEditor";
import {
  editorInsertAudioBlock,
  editorRedo,
  editorUndo,
} from "../../../shared/components/NoteEditor/lib/editorCommands";
import {
  IconArrowUturnBackward,
  IconArrowUturnForward,
  IconChevronLeft,
  IconMicrophoneFill,
  IconRectangleStack,
} from "../../../shared/components/PlatformIcon";
import {
  CARET_BOTTOM_PADDING,
  MOBILE_HEADER_HEIGHT,
  MOBILE_TOOLBAR_OFFSET,
  useCaretScroll,
} from "../../../shared/hooks/useCaretScroll";
import {
  type DisplayMode,
  activeNoteAtom,
  dictaphoneModeAtom,
  displayModeAtom,
  folderPathAtom,
  mobileNavigateAtom,
  mobileResetNavAtom,
  noteBackStackAtom,
  openTabIdsAtom,
  pendingAudioInsertAtom,
  pendingDisplayModeAtom,
} from "../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import { NoteType } from "../../../shared/lib/noteTypes";
import { isAndroid, isIOS } from "../../../shared/lib/platform";

import clsx from "clsx";
import { useKeyboard } from "../../hooks/useKeyboard";
import { hapticImpact } from "../../lib/haptics";
import { MobileFormattingBar } from "./MobileFormattingBar";
import { MobileLinkMenu } from "./MobileLinkMenu";
import { MobileSpellMenu } from "./MobileSpellMenu";

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
  const displayMode = useAtomValue(displayModeAtom);
  const setPendingDisplayMode = useSetAtom(pendingDisplayModeAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const editorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  // Pour distinguer "changement de note" (restore) vs "changement clavier" (scroll caret)
  // dans l'effet unifié de scroll.
  const lastScrolledNoteIdRef = useRef<string | null>(null);
  const isBase = activeNote?.type === NoteType.BASE;
  const {
    height: keyboardHeight,
    isOpen: isKeyboardOpen,
    isAndroidOpen: androidKbOpen,
  } = useKeyboard();
  // Sur Android, le WebView est redimensionné par les insets natifs : visualViewport
  // ne voit plus le clavier (keyboardHeight reste à 0). On détecte l'ouverture via
  // isAndroidOpen pour piloter l'affichage de la barre de styles.
  const effectiveKbOpen = isAndroid ? androidKbOpen : isKeyboardOpen;
  const totalMobileInset =
    keyboardHeight > 0 || (isAndroid && androidKbOpen)
      ? keyboardHeight + MOBILE_TOOLBAR_OFFSET
      : 0;
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

  // Effet unifié : un seul calcul de scrollTop par cycle, qu'il vienne du
  // changement de note (restore) ou d'une ouverture clavier (caret-in-view).
  // Évite la race entre deux scrolls successifs sous 16 ms.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeNote) return;
    const raf = requestAnimationFrame(() => {
      if (lastScrolledNoteIdRef.current !== activeNote.id) {
        // Changement de note : restaurer la position sauvegardée.
        lastScrolledNoteIdRef.current = activeNote.id;
        container.scrollTop = scrollPositions.current.get(activeNote.id) ?? 0;
        return;
      }
      // Même note : ajustement clavier (caret-in-view) uniquement.
      if (keyboardHeight === 0) return;
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
  }, [activeNote, keyboardHeight]);

  // Consomme le bloc audio en attente après retour du dictaphone (insert-mode)
  useEffect(() => {
    if (!pendingAudioInsert) return;
    editorInsertAudioBlock(
      editorRef,
      folderPath ?? "",
      pendingAudioInsert.path,
      pendingAudioInsert.title
    );
    setPendingAudioInsert(null);
  }, [pendingAudioInsert, folderPath, setPendingAudioInsert]);

  if (!activeNote) return null;

  const headerContent = (
    <>
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setNoteBackStack([]);
          resetNav();
        }}
        className="flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-400 active:bg-gray-100 transition-colors"
      >
        <IconChevronLeft className="size-4" />
        <span className="text-base">Notes</span>
      </button>

      <div className="flex-1 flex justify-end items-center gap-1">
        <button
          type="button"
          onClick={() => editorUndo(editorRef)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-amber-400 active:bg-gray-100 transition-colors"
          title="Annuler (⌘Z)"
        >
          <IconArrowUturnBackward className="size-4.5" />
        </button>
        <button
          type="button"
          onClick={() => editorRedo(editorRef)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-amber-400 active:bg-gray-100 transition-colors"
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
                  setPendingDisplayMode(next);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-amber-400 active:bg-gray-100 transition-colors"
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
          className="w-9 h-9 flex items-center justify-center rounded-full text-amber-400 active:bg-gray-100 transition-colors"
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
          className="relative w-9 h-9 flex items-center justify-center rounded-full text-amber-400 active:bg-gray-100 transition-colors"
        >
          <IconRectangleStack className="size-5" />
          {openTabIds.length > 1 && (
            <span className="absolute -top-0.5 -right-0.5 bg-amber-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {openTabIds.length}
            </span>
          )}
        </button>
      </div>
    </>
  );

  // Sur Android, le WebView est déjà au-dessus du clavier (insets natifs), donc
  // on compense uniquement la hauteur de la formatting bar quand elle est visible.
  const paddingBottom = isAndroid
    ? androidKbOpen
      ? MOBILE_TOOLBAR_OFFSET + 16
      : "max(env(safe-area-inset-bottom), 16px)"
    : keyboardHeight > 0
      ? keyboardHeight + MOBILE_TOOLBAR_OFFSET
      : "max(env(safe-area-inset-bottom), 16px)";

  // Sur Android, les insets IME sont appliqués côté natif (MainActivity.kt) : le
  // WebView se redimensionne, la status bar est en padding du content, donc pt-12
  // n'est nécessaire que sur iOS (notch). Mais on garde la même structure pour les
  // deux plateformes : le pt-12 est inoffensif sur Android (status bar déjà gérée).
  return (
    <div className="flex flex-col h-full w-full fixed bg-white">
      <div
        className={clsx(
          "flex items-center w-full justify-between px-2 py-2 border-b bg-white border-gray-100 fixed top-0 z-30",
          isIOS ? "pt-12" : "pt-4"
        )}
      >
        {headerContent}
      </div>

      <div
        ref={scrollContainerRef}
        className={clsx(
          "flex-1 overflow-auto overscroll-none mobile-prose",
          isIOS ? "pt-23" : "pt-15"
        )}
        data-scrollable
        onScroll={handleScroll}
        style={{ paddingBottom }}
      >
        <NoteEditor
          editorRef={editorRef}
          defaultCollapsedFrontmatter
        />
      </div>

      <MobileFormattingBar
        editorRef={editorRef}
        keyboardHeight={keyboardHeight}
        isKeyboardOpen={effectiveKbOpen}
      />

      <MobileSpellMenu />
      <MobileLinkMenu />
    </div>
  );
}
