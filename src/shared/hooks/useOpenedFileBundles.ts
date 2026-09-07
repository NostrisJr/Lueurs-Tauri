// Écoute l'ouverture de fichiers .lueurs-note via association native (double-clic
// Finder, "Ouvrir avec" iOS…) — cold start (commande `opened_files`, buffer côté
// Rust) et app déjà lancée (event "opened-files"). Importe dans la boîte aux
// lettres configurée (Réglages > Vault) puis recharge l'arbre.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import { useStore } from "jotai";
import { useEffect, useRef } from "react";
import {
  activeSpaceAtom,
  folderPathAtom,
  mailboxAbsPathAtom,
  toastAtom,
} from "../lib/atoms";
import { importBundle } from "../lib/bundle/bundleImport";
import { BUNDLE_EXTENSION } from "../lib/bundle/bundleShared";
import { BASE_NULL } from "../lib/importUtils";
import { createLogger } from "../lib/logger";
import { useFileTree } from "./useFileTree";

const log = createLogger("useOpenedFileBundles");

const KIND_LABELS: Record<string, string> = {
  note: "Note importée",
  folder: "Dossier importé",
  media: "Média importé",
};

export function useOpenedFileBundles() {
  const store = useStore();
  const { reload } = useFileTree();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    let cancelled = false;

    async function handlePaths(paths: string[]) {
      const bundlePaths = paths.filter((p) =>
        p.toLowerCase().endsWith(`.${BUNDLE_EXTENSION}`)
      );
      for (const path of bundlePaths) {
        const vaultPath = store.get(folderPathAtom);
        const mailboxPath = store.get(mailboxAbsPathAtom);
        if (!vaultPath || !mailboxPath) {
          log.warn("bundle ouvert sans vault actif, ignoré", { path });
          continue;
        }
        try {
          const bytes = await readFile(path, BASE_NULL);
          const result = await importBundle(
            bytes,
            vaultPath,
            mailboxPath,
            store.get(activeSpaceAtom)
          );
          if (cancelled) return;
          reloadRef.current();
          store.set(toastAtom, KIND_LABELS[result.kind] ?? "Import terminé");
          log.info("bundle importé depuis association de fichier", {
            path,
            result,
          });
        } catch (err) {
          log.error("échec import bundle", { path, err });
          store.set(toastAtom, "Échec de l'import du fichier partagé");
        }
      }
    }

    invoke<string[]>("opened_files")
      .then(handlePaths)
      .catch(() => {});
    const unlisten = listen<string[]>("opened-files", (e) =>
      handlePaths(e.payload)
    );

    return () => {
      cancelled = true;
      unlisten.then((fn) => fn());
    };
  }, [store]);
}
