import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMobileSelectNote } from "./hooks/useMobileSelectNote";
import { IconFolder } from "../shared/components/PlatformIcon";
import { MediaViewer } from "../shared/components/MediaViewer/MediaViewer";
import { useFileTree } from "../shared/hooks/useFileTree";
import { useVaultSync } from "../shared/hooks/useVaultSync";
import {
  type MobileView,
  activeMediaAtom,
  dictaphoneModeAtom,
  folderPathAtom,
  inboxAbsPathAtom,
  mobileGoBackAtom,
  mobileNavStackAtom,
  mobilePrevViewAtom,
  mobileViewAtom,
  treeAtom,
} from "../shared/lib/atoms";
import { isAndroid, isIOS } from "../shared/lib/platform";
import { MobileDictaphone } from "./components/Dictaphone/MobileDictaphone";
import { MobileEditor } from "./components/Editor/MobileEditor";
import { MobileFileTree } from "./components/FileTree";
import { SearchView } from "./components/Search/SearchView";
import { MobileSettingsView } from "./components/Settings/MobileSettingsView";
import { MobileTabsView } from "./components/TabsView/MobileTabsView";
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

  const [pendingNewNote, setPendingNewNote] = useState(false);

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

  // Retire l'overlay UIKit natif quand le vault est prêt (arbre chargé ou pas de vault configuré).
  useEffect(() => {
    if (!isIOS) return;
    const appPret = !folderPath || tree.length > 0;
    if (appPret) invoke("dismiss_native_splash").catch(() => {});
  }, [folderPath, tree.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: init au montage uniquement
  useEffect(() => {
    // Sur iOS, pickFolder() auto-détecte iCloud sans interaction utilisateur.
    // Sur Android, on n'ouvre pas le picker automatiquement : l'écran d'accueil s'en charge.
    if (isIOS) pickFolder();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: réagit au changement de vault
  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

  const navStack = useAtomValue(mobileNavStackAtom);
  const currentView = useAtomValue(mobileViewAtom);
  const previousView = useAtomValue(mobilePrevViewAtom);
  const goBack = useSetAtom(mobileGoBackAtom);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: navStack.length est intentionnel — l'effet ne doit réagir qu'aux changements de taille (push/pop), pas aux mutations de contenu
  useLayoutEffect(() => {
    const prevLen = prevNavLengthRef.current;
    prevNavLengthRef.current = navStack.length;
    if (navStack.length === prevLen + 1) {
      const from = navStack[navStack.length - 2];
      if (!from) return;
      setPushFrom(from);
      triggerPush();
    }
  }, [navStack.length, triggerPush]);

  const isPushing = isPushActive && pushFrom !== null;

  // ── Animation swipe retour ────────────────────────────────────
  const { swipeProgress, isAnimating, touchHandlers } = useMobileSwipeGesture(
    goBack,
    { enabled: navStack.length > 1 && !isPushing }
  );
  const isSwipingBack = swipeProgress > 0 || isAnimating;

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
      : {};

  if (!folderPath && isAndroid) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-200 gap-6 px-8">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow">
          <IconFolder className="size-8 text-amber-500" />
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
      className="fixed inset-0 overflow-hidden bg-gray-100"
      onTouchStart={touchHandlers.onTouchStart}
      onTouchMove={touchHandlers.onTouchMove}
      onTouchEnd={touchHandlers.onTouchEnd}
    >
      {/* Couche de fond — vues non-éditeur seulement */}
      {showBg && bgView && bgView !== "editor" && (
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
        <div className="absolute inset-0" style={{ ...currentStyle, zIndex: 2 }}>
          <ViewRenderer view={currentView} />
        </div>
      )}

      {dictaphoneMode !== null && <MobileDictaphone />}
    </div>
  );
}
