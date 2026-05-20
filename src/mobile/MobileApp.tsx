import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconFolder } from "../shared/components/PlatformIcon";
import { useFileTree } from "../shared/hooks/useFileTree";
import { useVaultSync } from "../shared/hooks/useVaultSync";
import {
  type MobileView,
  dictaphoneModeAtom,
  folderPathAtom,
  mobileGoBackAtom,
  mobileNavStackAtom,
  mobilePrevViewAtom,
  mobileViewAtom,
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
import "./MobileApp.css";

function ViewRenderer({ view }: { view: MobileView }) {
  switch (view) {
    case "editor":
      return <MobileEditor />;
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
  const { pickFolder, initFolder } = useFileTree();
  const folderPath = useAtomValue(folderPathAtom);
  const dictaphoneMode = useAtomValue(dictaphoneModeAtom);
  useVaultSync();

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
  const isPushActiveRef = useRef(false);
  const [pushFrom, setPushFrom] = useState<MobileView | null>(null);
  const [pushPhase, setPushPhase] = useState<"initial" | "animating" | null>(
    null
  );
  const pushRafRef = useRef<number>(0);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useLayoutEffect(() => {
    const prevLen = prevNavLengthRef.current;
    prevNavLengthRef.current = navStack.length;
    if (navStack.length === prevLen + 1 && !isPushActiveRef.current) {
      const from = navStack[navStack.length - 2];
      if (!from) return;
      isPushActiveRef.current = true;
      setPushFrom(from);
      setPushPhase("initial");
    }
  }, [navStack.length]);

  // Déclenche la transition CSS après que le frame "initial" a été peint
  useEffect(() => {
    if (pushPhase !== "initial") return;
    pushRafRef.current = requestAnimationFrame(() => {
      setPushPhase("animating");
      clearTimeout(pushTimeoutRef.current);
      pushTimeoutRef.current = setTimeout(() => {
        setPushFrom(null);
        setPushPhase(null);
        isPushActiveRef.current = false;
      }, DURATION);
    });
    return () => cancelAnimationFrame(pushRafRef.current);
  }, [pushPhase]);

  const isPushing = pushPhase !== null && pushFrom !== null;

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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 gap-6 px-8">
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

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-gray-100"
      onTouchStart={touchHandlers.onTouchStart}
      onTouchMove={touchHandlers.onTouchMove}
      onTouchEnd={touchHandlers.onTouchEnd}
    >
      {showBg && bgView && (
        <div className="absolute inset-0 pointer-events-none" style={bgStyle}>
          <ViewRenderer view={bgView} />
        </div>
      )}
      <div className="absolute inset-0" style={currentStyle}>
        <ViewRenderer view={currentView} />
      </div>
      {dictaphoneMode !== null && <MobileDictaphone />}
    </div>
  );
}
