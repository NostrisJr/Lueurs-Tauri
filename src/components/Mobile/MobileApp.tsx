import { useEffect } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { useAtomValue } from "jotai";
import { mobileViewAtom, folderPathAtom } from "../../lib/atoms.ts";
import { useFileTree } from "../FileTree/hooks/useFileTree";
import { useNote } from "../../hooks/useNote";
import { useVaultSync } from "../../hooks/useVaultSync";
import { MobileFileTree } from "./MobileFileTree";
import { MobileEditor } from "./MobileEditor";
import { MobileTabsView } from "./MobileTabsView";

export function MobileApp() {
  const view = useAtomValue(mobileViewAtom);

  /* // ── Empêche iOS de scroller le document ──────────────────────────────────
  // body { position: fixed } fige le layout viewport.
  // Le touchmove est bloqué sur tous les éléments sauf ceux marqués data-scrollable,
  // ce qui empêche le scroll natif sans snap-back visible.
  useEffect(() => {
    const { style } = document.body;
    style.position = "fixed";
    style.overflow = "hidden";

    const blockScroll = (e: TouchEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest("[data-scrollable]")) e.preventDefault();
    };
    document.addEventListener("touchmove", blockScroll, { passive: false });

    return () => {
      style.position = "";
      style.width = "";
      style.height = "";
      style.overflow = "";
      document.removeEventListener("touchmove", blockScroll);
    };
  }, []); */

  const { pickFolder, initFolder, createNote, createFolder } = useFileTree();
  const { handleRename } = useNote();
  const folderPath = useAtomValue(folderPathAtom);
  useVaultSync();

  // biome-ignore lint/correctness/useExhaustiveDependencies: init au montage uniquement
  useEffect(() => {
    if (platform() === "ios") pickFolder();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: réagit au changement de vault
  useEffect(() => {
    if (folderPath) initFolder();
  }, [folderPath]);

  const vaultPath = folderPath ?? "";

  if (view === "tabs") return <MobileTabsView />;
  if (view === "editor") return <MobileEditor />;

  return (
    <div className="h-full w-full flex items-center justify-center fixed">
      <MobileFileTree
        onCreateNote={(path) => createNote(path || vaultPath)}
        onCreateFolder={(path) => createFolder(path || vaultPath)}
        onRenameNode={handleRename}
      />
    </div>
  );
}
