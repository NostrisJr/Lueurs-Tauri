import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MediaViewer } from "../shared/components/MediaViewer/MediaViewer";
import { IconFolder } from "../shared/components/PlatformIcon";
import { ShareResolutionDialog } from "../shared/components/ShareResolutionDialog";
import { useFileTree } from "../shared/hooks/useFileTree";
import { useOpenedFileBundles } from "../shared/hooks/useOpenedFileBundles";
import { useVaultSync } from "../shared/hooks/useVaultSync";
import {
  type MobileView,
  activeMediaAtom,
  dictaphoneModeAtom,
  folderPathAtom,
  inboxAbsPathAtom,
  mobileGoBackAtom,
  mobileNavStackAtom,
  mobileNavigateAtom,
  mobileOpenSheetCountAtom,
  mobilePrevViewAtom,
  mobileViewAtom,
  noteBackStackAtom,
  notesByIdAtom,
  popNoteBackAtom,
  treeAtom,
} from "../shared/lib/atoms";
import { iconAccentClass, isAndroid, isIOS } from "../shared/lib/platform";
import { MobileDictaphone } from "./components/Dictaphone/MobileDictaphone";
import { MobileEditor } from "./components/Editor/MobileEditor";
import { MobileFileTree } from "./components/FileTree";
import { NodePreviewCard } from "./components/Row";
import { SearchView } from "./components/Search/SearchView";
import { MobileSettingsView } from "./components/Settings/MobileSettingsView";
import { MobileTabsView } from "./components/TabsView/MobileTabsView";
import { MobileTrashView } from "./components/Trash/MobileTrashView";
import { useMobileSelectNote } from "./hooks/useMobileSelectNote";
import {
  DURATION,
  EASING,
  useMobileSwipeGesture,
} from "./hooks/useMobileSwipeGesture";
import { usePushAnimation } from "./hooks/usePushAnimation";
import "./MobileApp.css";

function EditorOrMediaViewer() {
  const activeMedia = useAtomValue(activeMediaAtom);
  if (activeMedia)
    return <MediaViewer key={activeMedia.id} media={activeMedia} />;
  return <MobileEditor />;
}

function ViewRenderer({ view }: { view: MobileView }) {
  switch (view) {
    case "editor":
      return <EditorOrMediaViewer />;
    case "tabs":
      return <MobileTabsView />;
    case "search":
      return <SearchView />;
    case "settings":
      return <MobileSettingsView />;
    case "trash":
      return <MobileTrashView />;
    default:
      return (
        <div className="h-full w-full flex items-center justify-center fixed">
          <MobileFileTree />
        </div>
      );
  }
}

export function MobileApp() {
  const { pickFolder, initFolder, createNote } = useFileTree();
  const folderPath = useAtomValue(folderPathAtom);
  const inboxPath = useAtomValue(inboxAbsPathAtom);
  const tree = useAtomValue(treeAtom);
  const dictaphoneMode = useAtomValue(dictaphoneModeAtom);
  const setDictaphoneMode = useSetAtom(dictaphoneModeAtom);
  const selectNote = useMobileSelectNote();
  useVaultSync();
  useOpenedFileBundles();

  const [pendingNewNote, setPendingNewNote] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // ── Bouton Centre de contrôle ─────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: setDictaphoneMode est stable
  useEffect(() => {
    if (!isIOS) return;
    const check = async () => {
      try {
        const action = await invoke<string | null>("check_pending_action");
        if (action === "recording") setDictaphoneMode("new-note-autostart");
        else if (action === "new-note") setPendingNewNote(true);
      } catch {
        /* ignore sur les autres plateformes */
      }
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Exécuté dès que folderPath est disponible (cas cold-start ou retour au premier plan)
  // biome-ignore lint/correctness/useExhaustiveDependencies: createNote et selectNote sont stables
  useEffect(() => {
    if (!pendingNewNote || !folderPath) return;
    setPendingNewNote(false);
    createNote(inboxPath ?? folderPath).then(selectNote);
  }, [pendingNewNote, folderPath]);

  // WKWebView scrolle l'ancêtre scrollable le plus proche pour révéler un champ qui
  // prend le focus — y compris quand ce champ est dans une vue encore hors écran
  // (translateX(100%)) pendant une animation de navigation. `overflow-hidden` n'y
  // change rien : le conteneur reste scrollable par le navigateur. La racine se
  // retrouvait ainsi scrollée de ~230 px, décalant définitivement les trois couches
  // (l'éditeur garé redevenant visible au passage). Ce scroll n'est jamais légitime
  // ici : la racine fait exactement la taille du viewport.
  useEffect(() => {
    const onScroll = (e: Event) => {
      const root = rootRef.current;
      if (!root || e.target !== root) return;
      root.scrollLeft = 0;
      root.scrollTop = 0;
    };
    // En capture : l'évènement `scroll` ne remonte pas.
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  // Retire l'overlay UIKit natif quand le vault est prêt (arbre chargé ou pas de vault configuré).
  useEffect(() => {
    if (!isIOS) return;
    const appPret = !folderPath || tree.length > 0;
    if (appPret) invoke("dismiss_native_splash").catch(() => {});
  }, [folderPath, tree.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: init au montage uniquement
  useEffect(() => {
    // Sur iOS, pickFolder() auto-détecte iCloud sans interaction utilisateur — mais
    // seulement si aucun vault n'est encore persisté (sinon initFolder() ci-dessous
    // suffit : évite un appel FFI natif + une remontée FS à chaque lancement).
    // Sur Android, on n'ouvre pas le picker automatiquement : l'écran d'accueil s'en charge.
    if (isIOS && !folderPath) pickFolder();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: réagit au changement de vault
  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

  const navStack = useAtomValue(mobileNavStackAtom);
  const currentView = useAtomValue(mobileViewAtom);
  const previousView = useAtomValue(mobilePrevViewAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const navigate = useSetAtom(mobileNavigateAtom);

  // ── Animation push (navigation avant) ────────────────────────
  // useLayoutEffect garantit que le premier render de la nouvelle vue
  // est déjà à translateX(100%) avant que le navigateur ne peigne,
  // ce qui évite tout flash de la vue en position finale.
  const prevNavLengthRef = useRef(navStack.length);
  const [pushFrom, setPushFrom] = useState<MobileView | null>(null);
  const {
    phase: pushPhase,
    isActive: isPushActive,
    trigger: triggerPush,
  } = usePushAnimation(DURATION);
  // Le swipe avant vers les onglets (cf. plus bas) a déjà entièrement révélé
  // la vue au doigt avant d'appeler navigate("tabs") — sans ce drapeau, la
  // croissance de navStack qui en résulte redéclencherait triggerPush() et
  // rejouerait un slide-in par-dessus une vue déjà pleinement visible.
  const suppressNextPushRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: navStack.length est intentionnel — l'effet ne doit réagir qu'aux changements de taille (push/pop), pas aux mutations de contenu
  useLayoutEffect(() => {
    const prevLen = prevNavLengthRef.current;
    prevNavLengthRef.current = navStack.length;
    if (navStack.length === prevLen + 1) {
      if (suppressNextPushRef.current) {
        suppressNextPushRef.current = false;
        return;
      }
      const from = navStack[navStack.length - 2];
      if (!from) return;
      setPushFrom(from);
      triggerPush();
    }
  }, [navStack.length, triggerPush]);

  const isPushing = isPushActive && pushFrom !== null;

  // ── Animation swipe retour ────────────────────────────────────
  // (Pas de garde croisée avec le swipe avant vers les onglets ci-dessous :
  // les deux bords sont physiquement disjoints, un seul doigt ne peut jamais
  // armer les deux à la fois.)
  const popNoteBack = useSetAtom(popNoteBackAtom);
  const openSheetCount = useAtomValue(mobileOpenSheetCountAtom);
  // Swipe back/avant désactivés tant qu'une BottomSheet/un RowContextMenu est
  // monté (cf. mobileOpenSheetCountAtom) — plutôt que de tenter de la
  // refermer au geste : l'animation de swipe se joue de toute façon en
  // entier AVANT que le callback de complétion ne soit appelé (cf.
  // useMobileSwipeGesture.complete()), donc fermer-au-lieu-de-naviguer
  // laissait un aller-retour visuel raté (écran révélé puis re-claqué). Pour
  // fermer une sheet ouverte, on utilise son propre geste de fermeture
  // (swipe interne, tap extérieur).
  //
  // popNoteBack (chaîne de navigation note→note, cf. NoteChip/wikilinks)
  // reste dans l'éditeur (même onglet, note précédente) ; sinon retour de vue
  // normal.
  function handleSwipeBack() {
    if (popNoteBack()) return;
    goBack();
  }
  const { swipeProgress, isAnimating, touchHandlers } = useMobileSwipeGesture(
    handleSwipeBack,
    { enabled: navStack.length > 1 && !isPushing && openSheetCount === 0 }
  );
  const isSwipingBack = swipeProgress > 0 || isAnimating;

  // Note vers laquelle une chaîne de navigation (NoteChip "Ouvrir", wikilink)
  // reviendrait — cf. popNoteBack ci-dessus. mobileNavStackAtom ne porte que
  // des VUES, pas des notes (navigateToNoteAtom ne le touche jamais), donc
  // bgView (mobilePrevViewAtom) reste "filetree" tout du long d'une chaîne :
  // sans ce calque dédié, un swipe-back révélait le file tree au doigt puis
  // "sautait" sur la vraie note précédente seulement à la complétion du
  // geste. Aperçu léger (titre + début du corps, pas l'éditeur Milkdown
  // lui-même) : un deuxième éditeur temporaire pour la durée du geste
  // coûterait exactement la réinitialisation que l'éditeur singleton
  // (cf. commentaire plus bas) est conçu pour éviter.
  const noteBackStack = useAtomValue(noteBackStackAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const peekBackNoteId =
    isSwipingBack && currentView === "editor"
      ? (noteBackStack[noteBackStack.length - 1] ?? null)
      : null;
  const peekBackNode = peekBackNoteId
    ? notesById.get(peekBackNoteId)
    : undefined;

  // ── Animation swipe avant vers les onglets ────────────────────
  // Symétrique du swipe retour : la vue "onglets" est révélée en direct sous
  // le doigt (cf. tabsPreviewStyle plus bas), navigate("tabs") n'arrivant
  // qu'au relâchement, une fois le geste validé. excludeSelector laisse le
  // switcher d'espaces (qui chevauche le bord droit, cf. MobileSpaceSwitcher)
  // gérer lui-même ses taps/appuis longs.
  const {
    swipeProgress: tabsSwipeProgress,
    isAnimating: isTabsSwipeAnimating,
    touchHandlers: tabsTouchHandlers,
  } = useMobileSwipeGesture(
    () => {
      suppressNextPushRef.current = true;
      navigate("tabs");
    },
    {
      edge: "right",
      enabled:
        currentView !== "tabs" &&
        !isPushing &&
        !isSwipingBack &&
        openSheetCount === 0,
      excludeSelector: "[data-mobile-space-switcher]",
    }
  );
  const isSwipingForward = tabsSwipeProgress > 0 || isTabsSwipeAnimating;

  function handleRootTouchStart(e: React.TouchEvent) {
    touchHandlers.onTouchStart(e);
    tabsTouchHandlers.onTouchStart(e);
  }
  function handleRootTouchMove(e: React.TouchEvent) {
    touchHandlers.onTouchMove(e);
    tabsTouchHandlers.onTouchMove(e);
  }
  function handleRootTouchEnd(e: React.TouchEvent) {
    touchHandlers.onTouchEnd(e);
    tabsTouchHandlers.onTouchEnd(e);
  }

  // ── Styles ────────────────────────────────────────────────────
  const showBg = isPushing || isSwipingBack;
  const bgView = isPushing ? pushFrom : previousView;

  const bgStyle: React.CSSProperties = isPushing
    ? pushPhase === "animating"
      ? {
          transform: "translateX(-30%)",
          transition: `transform ${DURATION}ms ${EASING}`,
          willChange: "transform",
        }
      : { transform: "translateX(0%)" }
    : {
        transform: `translateX(${(-30 + swipeProgress * 30).toFixed(1)}%)`,
        transition: isAnimating ? `transform ${DURATION}ms ${EASING}` : "none",
        willChange: "transform",
      };

  const currentStyle: React.CSSProperties = isPushing
    ? pushPhase === "initial"
      ? { transform: "translateX(100%)" }
      : {
          transform: "translateX(0%)",
          transition: `transform ${DURATION}ms ${EASING}`,
          willChange: "transform",
        }
    : isSwipingBack
      ? {
          transform: `translateX(${(swipeProgress * 100).toFixed(1)}%)`,
          transition: isAnimating
            ? `transform ${DURATION}ms ${EASING}`
            : "none",
          boxShadow:
            swipeProgress > 0 ? "-6px 0 20px rgba(0,0,0,0.10)" : undefined,
          willChange: "transform",
        }
      : isSwipingForward
        ? {
            // La vue courante recule en position "parquée" (-30%, même valeur
            // que pushFrom pendant un push) à mesure que les onglets arrivent
            // par-dessus — cf. tabsPreviewStyle.
            transform: `translateX(${(-30 * tabsSwipeProgress).toFixed(1)}%)`,
            transition: isTabsSwipeAnimating
              ? `transform ${DURATION}ms ${EASING}`
              : "none",
            willChange: "transform",
          }
        : {};

  const tabsPreviewStyle: React.CSSProperties = {
    transform: `translateX(${(100 - tabsSwipeProgress * 100).toFixed(1)}%)`,
    transition: isTabsSwipeAnimating
      ? `transform ${DURATION}ms ${EASING}`
      : "none",
    boxShadow:
      tabsSwipeProgress > 0 ? "-6px 0 20px rgba(0,0,0,0.10)" : undefined,
    willChange: "transform",
  };

  if (!folderPath && isAndroid) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-200 gap-6 px-8">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow">
          <IconFolder className={`size-8 ${iconAccentClass}`} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-lg">
            Aucun dossier sélectionné
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Choisis un dossier contenant tes fichiers .md
          </p>
        </div>
        <button
          type="button"
          onClick={pickFolder}
          className="px-6 py-3.5 rounded-xl bg-amber-500 text-white font-semibold text-base active:bg-amber-600 transition-colors"
        >
          Choisir un dossier
        </button>
      </div>
    );
  }

  // L'éditeur est toujours monté pour éviter la réinitialisation de Milkdown lors des
  // animations de navigation (le contexte editorState n'est pas prêt sur un nouveau montage).
  const editorIsCurrentView = currentView === "editor";
  const editorIsBgView = showBg && bgView === "editor";
  const editorAnimStyle: React.CSSProperties = editorIsCurrentView
    ? currentStyle
    : editorIsBgView
      ? bgStyle
      : { transform: "translateX(100%)", transition: "none" };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-hidden bg-gray-100"
      onTouchStart={handleRootTouchStart}
      onTouchMove={handleRootTouchMove}
      onTouchEnd={handleRootTouchEnd}
    >
      {/* Couche de fond — note précédente d'une chaîne de navigation (cf.
          peekBackNode ci-dessus), sinon vue précédente non-éditeur. */}
      {showBg && peekBackNode && (
        <div
          className="absolute inset-0 pointer-events-none bg-white overflow-hidden"
          style={{ ...bgStyle, zIndex: 1 }}
        >
          <NodePreviewCard node={peekBackNode} />
        </div>
      )}
      {showBg && !peekBackNode && bgView && bgView !== "editor" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ ...bgStyle, zIndex: 1 }}
        >
          <ViewRenderer view={bgView} />
        </div>
      )}

      {/* Éditeur — toujours monté, repositionné par le style d'animation */}
      <div
        className={clsx(
          "absolute inset-0",
          !editorIsCurrentView && "pointer-events-none"
        )}
        style={{ ...editorAnimStyle, zIndex: editorIsCurrentView ? 2 : 1 }}
      >
        <EditorOrMediaViewer />
      </div>

      {/* Couche de premier plan — vues non-éditeur seulement */}
      {currentView !== "editor" && (
        <div
          className="absolute inset-0"
          style={{ ...currentStyle, zIndex: 2 }}
        >
          <ViewRenderer view={currentView} />
        </div>
      )}

      {/* Aperçu des onglets pendant un swipe avant depuis le bord droit — révélé
          au doigt (cf. tabsPreviewStyle), symétrique de la couche de fond du
          swipe retour ci-dessus. navigate("tabs") ne fait que confirmer l'état
          déjà visible une fois le geste validé (cf. suppressNextPushRef). */}
      {isSwipingForward && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ ...tabsPreviewStyle, zIndex: 3 }}
        >
          <MobileTabsView />
        </div>
      )}

      {dictaphoneMode !== null && <MobileDictaphone />}
      <ShareResolutionDialog />
    </div>
  );
}
