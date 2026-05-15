import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFileTree } from "../shared/hooks/useFileTree";
import { useVaultSync } from "../shared/hooks/useVaultSync";
import {
  type MobileView,
  folderPathAtom,
  mobileGoBackAtom,
  mobileNavStackAtom,
  mobilePrevViewAtom,
  mobileViewAtom,
} from "../shared/lib/Atoms";
import {
  DURATION,
  EASING,
  useMobileSwipeGesture,
} from "./hooks/useMobileSwipeGesture";
import { MobileDictaphone } from "./components/Dictaphone/MobileDictaphone";
import { MobileEditor } from "./components/Editor/MobileEditor";
import { MobileFileTree } from "./components/FileTree";
import { MobileSettingsView } from "./components/Settings/MobileSettingsView";
import { MobileTabsView } from "./components/TabsView/MobileTabsView";
import { SearchView } from "./components/Search/SearchView";
import "./MobileApp.css";

function ViewRenderer({ view }: { view: MobileView }) {
  switch (view) {
    case "editor":
      return <MobileEditor />;
    case "tabs":
      return <MobileTabsView />;
    case "search":
      return <SearchView />;
    case "dictaphone":
      return <MobileDictaphone />;
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
  useVaultSync();

  // biome-ignore lint/correctness/useExhaustiveDependencies: init au montage uniquement
  useEffect(() => {
    pickFolder();
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
    </div>
  );
}
