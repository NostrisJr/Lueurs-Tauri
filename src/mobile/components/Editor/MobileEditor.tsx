import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { EditorErrorBoundary } from "../../../shared/components/EditorErrorBoundary";
import type { Editor } from "../../../shared/components/NoteEditor/MarkdownEditor";
import { NoteEditor } from "../../../shared/components/NoteEditor/NoteEditor";
import {
  editorFocusAtStart,
  editorInsertAudioBlock,
  editorRedo,
  editorUndo,
} from "../../../shared/components/NoteEditor/lib/editorCommands";
import {
  IconArrowUturnBackward,
  IconArrowUturnForward,
  IconChevronLeft,
  IconEllipsis,
  IconMagnifyingglass,
  IconRecordAudio,
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
import { NoteType, isNoteReadOnly } from "../../../shared/lib/noteTypes";
import {
  iconAccentClass,
  isAndroid,
  isIOS,
} from "../../../shared/lib/platform";
import { openSearchBar } from "../../../shared/plugins/search/searchState";

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

  // Menu "..." (actions secondaires — pour l'instant : recherche/remplacement).
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreMenuRendered, setMoreMenuRendered] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const MORE_MENU_ANIM_MS = 180;
  useEffect(() => {
    if (showMoreMenu) {
      setMoreMenuRendered(true);
      const raf = requestAnimationFrame(() => setMoreMenuVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setMoreMenuVisible(false);
    const t = setTimeout(() => setMoreMenuRendered(false), MORE_MENU_ANIM_MS);
    return () => clearTimeout(t);
  }, [showMoreMenu]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  // Pour distinguer "changement de note" (restore) vs "changement clavier" (scroll caret)
  // dans l'effet unifié de scroll.
  const lastScrolledNoteIdRef = useRef<string | null>(null);
  const isBase = activeNote?.type === NoteType.BASE;
  const isReadOnly = isNoteReadOnly(activeNote?.frontmatter);
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

  // Note vide : le contenu rendu (header + frontmatter + une ligne vide) n'occupe
  // qu'une petite zone en haut de la page. On étend la zone cliquable à tout le
  // conteneur scrollable pour entrer en édition, sauf si le clic vise déjà un
  // contrôle interactif (titre, emoji, l'éditeur lui-même…).
  const handleContentClick = useCallback(
    (ev: MouseEvent<HTMLDivElement>) => {
      if (!activeNote || isBase || isReadOnly) return;
      if (activeNote.body.trim().length > 0) return;
      const target = ev.target as HTMLElement;
      if (target.closest("input, textarea, button, [contenteditable]")) return;
      editorFocusAtStart(editorRef);
    },
    [activeNote, isBase, isReadOnly]
  );

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
        className={`flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg ${iconAccentClass} active:bg-gray-100 transition-colors`}
      >
        <IconChevronLeft className="size-4" />
        <span className="text-base">Notes</span>
      </button>

      <div className="flex-1 flex justify-end items-center gap-1">
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() => editorUndo(editorRef)}
          className={`w-9 h-9 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-gray-100 transition-colors disabled:opacity-30`}
          title="Annuler (⌘Z)"
        >
          <IconArrowUturnBackward className="size-4.5" />
        </button>
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() => editorRedo(editorRef)}
          className={`w-9 h-9 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-gray-100 transition-colors disabled:opacity-30`}
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
                className={`w-9 h-9 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-gray-100 transition-colors`}
                title={currentEntry.label}
              >
                <currentEntry.Icon className="size-5" />
              </button>
            );
          })()}
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setDictaphoneMode("insert");
            }}
            className={`w-9 h-9 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-gray-100 transition-colors`}
            title="Ajouter un enregistrement"
          >
            <IconRecordAudio className="size-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            navigate("tabs");
          }}
          className={`relative w-9 h-9 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-gray-100 transition-colors`}
        >
          <IconRectangleStack className="size-5" />
          {openTabIds.length > 1 && (
            <span className="absolute -top-0.5 -right-0.5 bg-amber-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {openTabIds.length}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              hapticImpact("light");
              setShowMoreMenu((v) => !v);
            }}
            className={`w-9 h-9 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-gray-100 transition-colors`}
            aria-label="Plus d'actions"
          >
            <IconEllipsis className="size-4.5" />
          </button>

          {moreMenuRendered && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile de fermeture */}
              <div
                className="fixed inset-0 z-40"
                style={{ background: "rgba(0,0,0,0.01)" }}
                onClick={() => setShowMoreMenu(false)}
              />
              <div className="absolute right-0 top-10 z-50">
                <div
                  className="absolute inset-0 rounded-2xl shadow-xl"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(40px) saturate(180%)",
                    WebkitBackdropFilter: "blur(40px) saturate(180%)",
                    border: "1px solid rgba(0,0,0,0.06)",
                    transformOrigin: "top right",
                    transform: moreMenuVisible ? "scale(1)" : "scale(0.85)",
                    opacity: moreMenuVisible ? 1 : 0,
                    transition: `transform ${MORE_MENU_ANIM_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${MORE_MENU_ANIM_MS}ms ease-out`,
                  }}
                />
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    minWidth: 220,
                    opacity: moreMenuVisible ? 1 : 0,
                    transform: moreMenuVisible
                      ? "translateY(0)"
                      : "translateY(-6px)",
                    transition:
                      "opacity 100ms ease-out, transform 100ms ease-out",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      hapticImpact("light");
                      openSearchBar();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
                  >
                    <IconMagnifyingglass className="size-4 text-gray-500" />
                    Rechercher et remplacer
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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
        onClick={handleContentClick}
        style={{ paddingBottom }}
      >
        <EditorErrorBoundary>
          <NoteEditor editorRef={editorRef} defaultCollapsedFrontmatter />
        </EditorErrorBoundary>
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
