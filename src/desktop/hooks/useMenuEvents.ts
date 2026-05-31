// Écoute les événements du menu natif macOS et les dispatch vers les actions de l'app.
// Déclenché par les items "Fichier" : Importer, Révéler dans le Finder, Supprimer la note.

import { listen } from "@tauri-apps/api/event";
import { Command } from "@tauri-apps/plugin-shell";
import { useStore } from "jotai";
import { useEffect, useRef } from "react";
import { useFileTree } from "../../shared/hooks/useFileTree";
import { useNote } from "../../shared/hooks/useNote";
import { activeNoteAtom, activeMediaAtom, folderPathAtom } from "../../shared/lib/atoms";
import { createLogger } from "../../shared/lib/logger";
import { importPaths } from "../../shared/lib/importUtils";

const log = createLogger("useMenuEvents");

export function useMenuEvents() {
  const store = useStore();
  const { reload } = useFileTree();
  const { handleDeleteNote } = useNote();

  const cbRef = useRef({ reload, handleDeleteNote });
  cbRef.current = { reload, handleDeleteNote };

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // ── Importer des fichiers ou dossiers ──────────────────────────────────
    listen<string[]>("menu:import-files", async (event) => {
      const paths = event.payload;
      if (!paths || paths.length === 0) return;

      const vaultPath = store.get(folderPathAtom);
      if (!vaultPath) return;

      try {
        await importPaths(vaultPath, paths);
        cbRef.current.reload();
        log.info("import menu terminé", { count: paths.length, targetPath: vaultPath });
      } catch (err) {
        log.error("échec import menu", err);
      }
    }).then((fn) => unlisteners.push(fn));

    // ── Révéler dans le Finder ─────────────────────────────────────────────
    // Utilise osascript (déjà dans l'allow list) plutôt que plugin-opener
    // dont la Rust side crashe sur macOS (NSWorkspace hors thread principal).
    listen("menu:reveal-in-finder", async () => {
      const activeNote = store.get(activeNoteAtom);
      const activeMedia = store.get(activeMediaAtom);
      const activePath = activeNote?.id ?? activeMedia?.id ?? store.get(folderPathAtom);
      if (!activePath) return;

      const escaped = activePath.replace(/"/g, '\\"');
      try {
        await Command.create("osascript", [
          "-e", `tell application "Finder" to reveal POSIX file "${escaped}"`,
          "-e", `tell application "Finder" to activate`,
        ]).execute();
        log.info("révélé dans le Finder", { activePath });
      } catch (err) {
        log.error("échec révélation Finder", err);
      }
    }).then((fn) => unlisteners.push(fn));

    // ── Supprimer la note ──────────────────────────────────────────────────
    listen("menu:delete-note", async () => {
      const activeNote = store.get(activeNoteAtom);
      if (!activeNote) return;
      try {
        await cbRef.current.handleDeleteNote(activeNote.id);
        log.info("note supprimée via menu", { id: activeNote.id });
      } catch (err) {
        log.error("échec suppression via menu", err);
      }
    }).then((fn) => unlisteners.push(fn));

    return () => {
      for (const fn of unlisteners) fn();
    };
  }, [store]);
}
