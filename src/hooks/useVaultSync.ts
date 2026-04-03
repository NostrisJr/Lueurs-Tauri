import { useEffect } from "react";
import { useSetAtom, useStore } from "jotai";
import { listen } from "@tauri-apps/api/event";
import { treeAtom, folderPathAtom } from "../lib/atoms.ts";
import { updateNodeInTree } from "../components/FileTree/lib/fileTreeHelpers";
import { noteFromRaw } from "../lib/vaultIO";
import { createLogger } from "../lib/logger";

const log = createLogger("useVaultSync");

interface NotePatch {
  id: string;
  raw_content: string;
}

/**
 * Écoute les événements vault:patch émis par Rust et réconcilie treeAtom.
 * À monter une seule fois à la racine de l'app.
 */
export function useVaultSync() {
  const setTree = useSetAtom(treeAtom);
  const store = useStore();

  useEffect(() => {
    const promise = listen<NotePatch[]>("vault:patch", (event) => {
      const vaultPath = store.get(folderPathAtom) ?? undefined;
      for (const patch of event.payload) {
        const filename = patch.id.split("/").pop() ?? "";
        const note = noteFromRaw(
          patch.id,
          filename,
          patch.raw_content,
          vaultPath
        );
        setTree((prev) => updateNodeInTree(prev, patch.id, note));
        log.info("note réconciliée depuis vault:patch", { id: patch.id });
      }
    });

    return () => {
      promise.then((unlisten) => unlisten());
    };
  }, [setTree]);
}
