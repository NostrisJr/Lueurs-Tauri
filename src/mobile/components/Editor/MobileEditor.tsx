import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { EditorErrorBoundary } from "../../../shared/components/EditorErrorBoundary";
import type { Editor } from "../../../shared/components/NoteEditor/MarkdownEditor";
import { NoteEditor } from "../../../shared/components/NoteEditor/NoteEditor";
import {
  editorFocusAtStart,
  editorInsertAudioBlock,
} from "../../../shared/components/NoteEditor/lib/editorCommands";
import { IconChevronLeft } from "../../../shared/components/PlatformIcon";
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
import { NoteType, isNoteReadOnly } from "../../../shared/lib/noteTypes";
import { iconAccentClass, isAndroid } from "../../../shared/lib/platform";

import { useKeyboard } from "../../hooks/useKeyboard";
import {
  DURATION as SWIPE_DURATION,
  EASING as SWIPE_EASING,
  useMobileSwipeGesture,
} from "../../hooks/useMobileSwipeGesture";
import { hapticImpact } from "../../lib/haptics";
import {
  FLOATING_HEADER_SCROLL_OFFSET,
  FloatingHeaderBar,
  TITLE_COLLAPSE_RANGE,
  TITLE_COLLAPSE_START,
} from "../Floating/FloatingHeaderBar";
import { MobileEditorMenu } from "./MobileEditorMenu";
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
  // Racine de l'éditeur — cible du portail du morph de titre (MobileNoteTitle) :
  // rester dans ce sous-arbre pour suivre le translateX du swipe retour (cf.
  // wrapper animé dans MobileApp), plutôt qu'un portail vers document.body qui
  // resterait figé à l'écran pendant la transition.
  const editorRootRef = useRef<HTMLDivElement>(null);
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

  // Swipe depuis le bord droit : accès aux onglets de l'espace courant,
  // symétrique au swipe gauche (retour arrière) géré globalement dans MobileApp.
  // completeDelay: 0 — pas de reveal à deux couches ici, juste le petit
  // rubber-band ; attendre DURATION avant navigate() ne faisait qu'ajouter
  // une latence perçue pour rien.
  const {
    swipeProgress: tabsSwipeProgress,
    isAnimating: isTabsSwipeAnimating,
    touchHandlers: tabsSwipeHandlers,
  } = useMobileSwipeGesture(() => navigate("tabs"), {
    edge: "right",
    completeDelay: 0,
  });

  // Titre minimisé au scroll : progression continue (0 = titre plein, 1 = fondu
  // dans la barre flottante), directement égale à scrollTop sur cette plage —
  // aucune transition CSS à côté, pour que l'animation reste exactement
  // synchrone avec le doigt (un petit scroll ne joue qu'une petite partie).
  const [titleCollapseProgress, setTitleCollapseProgress] = useState(0);
  const titleCollapseProgressRef = useRef(0);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (activeNote) {
      scrollPositions.current.set(activeNote.id, container.scrollTop);
    }
    const progress = Math.min(
      Math.max(
        (container.scrollTop - TITLE_COLLAPSE_START) / TITLE_COLLAPSE_RANGE,
        0
      ),
      1
    );
    if (progress !== titleCollapseProgressRef.current) {
      titleCollapseProgressRef.current = progress;
      setTitleCollapseProgress(progress);
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

  // Contenu des slots gauche/droite de la barre flottante headerless (le
  // morphing pill/collapse est géré par FloatingHeaderBar) — le reste des
  // actions vit dans MobileEditorMenu.
  const backButton = (
    <button
      type="button"
      onClick={() => {
        hapticImpact("light");
        setNoteBackStack([]);
        resetNav();
      }}
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
      aria-label="Retour aux notes"
      title="Retour aux notes"
    >
      <IconChevronLeft className="size-4" />
    </button>
  );

  const menuButton = (
    <MobileEditorMenu
      editorRef={editorRef}
      isBase={isBase}
      isReadOnly={isReadOnly}
      displayMode={displayMode}
      openTabsCount={openTabIds.length}
      onDisplayModeChange={(mode: DisplayMode) => setPendingDisplayMode(mode)}
      onRecord={() => setDictaphoneMode("insert")}
      onOpenTabs={() => navigate("tabs")}
    />
  );

  // Zone de fondu en haut du scroll container, alignée sur la hauteur de la
  // barre flottante : son fond est translucide (pills vitrées ou icônes nues),
  // donc le contenu qui la traverse en scrollant doit s'estomper progressivement
  // plutôt que d'être coupé net par l'overflow au bord du scroll container (qui
  // démarre à y=0, derrière la barre fixe).
  // Rampe non-linéaire (vs. transparent→black uniforme) : le contenu reste très
  // estompé sur la majeure partie de la zone, et ne redevient net que juste
  // avant la barre — un ramp linéaire le laissait trop lisible dès le début.
  // Stops en px (pas %) : un % serait relatif à toute la hauteur du scroll
  // container (mask-size 100% 100%), pas à la seule zone de fondu voulue.
  // Palier intermédiaire à 0.04, repoussé à 80% de la zone (pas 0.12 à 60%) :
  // le titre morphé (MobileNoteTitle) n'a plus de fond pill derrière lui, donc
  // le contenu doit rester quasi blanc (quasi entièrement masqué) sur toute la
  // zone qu'il traverse, et ne redevenir net que dans les tout derniers px.
  // Zone de fondu volontairement plus haute que FLOATING_HEADER_SCROLL_OFFSET
  // (déborde sous la zone réservée) : le retour à l'opacité pleine doit se
  // produire plus bas pour rester lisible, quitte à assombrir un peu de
  // contenu déjà visible sous la barre.
  const headerFadeZoneHeight = FLOATING_HEADER_SCROLL_OFFSET * 1.45;
  // Intensité pilotée par titleCollapseProgress (pas un dégradé statique) :
  // au repos (progress=0, tout en haut de la page), le titre en flux ne doit
  // pas être assombri — le fondu n'apparaît qu'au fil du scroll, en même
  // temps que le morph vers la pill (stop final toujours "black" : le
  // contenu sous la zone de fondu reste, lui, toujours pleinement visible).
  const headerFadeTopAlpha = 1 - titleCollapseProgress;
  const headerFadeMidAlpha = 1 - titleCollapseProgress * 0.96;
  const headerFadeMask = `linear-gradient(to bottom, rgba(0,0,0,${headerFadeTopAlpha}) 0, rgba(0,0,0,${headerFadeMidAlpha}) ${
    headerFadeZoneHeight * 0.8
  }px, black ${headerFadeZoneHeight}px)`;

  // Sur Android, le WebView est déjà au-dessus du clavier (insets natifs), donc
  // on compense uniquement la hauteur de la formatting bar quand elle est visible.
  const paddingBottom = isAndroid
    ? androidKbOpen
      ? MOBILE_TOOLBAR_OFFSET + 16
      : "max(env(safe-area-inset-bottom), 16px)"
    : keyboardHeight > 0
      ? keyboardHeight + MOBILE_TOOLBAR_OFFSET
      : "max(env(safe-area-inset-bottom), 16px)";

  return (
    <div
      ref={editorRootRef}
      className="flex flex-col h-full w-full fixed bg-white"
      onTouchStart={tabsSwipeHandlers.onTouchStart}
      onTouchMove={tabsSwipeHandlers.onTouchMove}
      onTouchEnd={tabsSwipeHandlers.onTouchEnd}
    >
      <FloatingHeaderBar
        collapseProgress={titleCollapseProgress}
        left={backButton}
        right={menuButton}
      />

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick étend la zone
          cliquable d'entrée en édition sur une note vide (cf. handleContentClick) —
          zone tactile, pas de pendant clavier pertinent ici. */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto overscroll-none mobile-prose"
        data-scrollable
        onScroll={handleScroll}
        onClick={handleContentClick}
        style={{
          paddingTop: FLOATING_HEADER_SCROLL_OFFSET,
          paddingBottom,
          maskImage: headerFadeMask,
          WebkitMaskImage: headerFadeMask,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          transform:
            tabsSwipeProgress > 0
              ? `translateX(${(-tabsSwipeProgress * 24).toFixed(1)}px)`
              : undefined,
          transition: isTabsSwipeAnimating
            ? `transform ${SWIPE_DURATION}ms ${SWIPE_EASING}`
            : undefined,
        }}
      >
        <EditorErrorBoundary>
          <NoteEditor
            editorRef={editorRef}
            titleCollapseProgress={titleCollapseProgress}
            titlePortalContainer={editorRootRef}
          />
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
