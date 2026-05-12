import { Component, useEffect } from "react";
import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { mobileViewAtom, folderPathAtom } from "../../shared/lib/Atoms";
import { useFileTree } from "../../shared/hooks/useFileTree";
import { useVaultSync } from "../../shared/hooks/useVaultSync";
import { MobileFileTree } from "./MobileFileTree";
import { MobileEditor } from "./MobileEditor";
import { MobileTabsView } from "./MobileTabsView";
import { MobileDictaphone } from "./MobileDictaphone";
import "../MobileApp.css";
import { SearchView } from "./SearchView";

class MobileErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: "white", minHeight: "100vh", color: "red", fontFamily: "monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
          {String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

export function MobileApp() {
  const view = useAtomValue(mobileViewAtom);
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

  if (view === "tabs") return <MobileTabsView />;
  if (view === "editor") return <MobileEditor />;
  if (view === "search") return <SearchView />;
  if (view === "dictaphone") return <MobileDictaphone />;

  return (
    <div className="h-full w-full flex items-center justify-center fixed">
      <MobileFileTree />
    </div>
  );
}
