import { useEffect } from "react";
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
