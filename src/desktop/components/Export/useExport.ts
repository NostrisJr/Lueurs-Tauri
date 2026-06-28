import { editorViewCtx } from "@milkdown/kit/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { activeEditorRef } from "../../../shared/components/NoteEditor/lib/activeEditorRef";
import {
  activeNoteAtom,
  activeNoteFolderAtom,
  allFoldersAtom,
  exportFolderIdAtom,
  exportModeAtom,
  exportOptionsAtom,
  exportOptionsMultiDocAtom,
  folderPathAtom,
  infoAuteurAtom,
  toastAtom,
} from "../../../shared/lib/atoms";
import { compilerDossierVersTypst } from "../../../shared/lib/compilerDossier";
import {
  OPTIONS_DEFAUT,
  OPTIONS_MULTI_DOC_DEFAUT,
  type OptionsMultiDocument,
  proseMirrorDocVersTypst,
} from "../../../shared/lib/proseToTypst";

export function useExport(open: boolean) {
  const activeNote = useAtomValue(activeNoteAtom);
  const vaultPath = useAtomValue(folderPathAtom) ?? "";
  const setToast = useSetAtom(toastAtom);
  const infoAuteur = useAtomValue(infoAuteurAtom);

  // Lecture seule — les écritures viennent de ExportPanneauOptions
  const storedOptions = useAtomValue(exportOptionsAtom);
  const options = { ...OPTIONS_DEFAUT, ...storedOptions };

  const exportMode = useAtomValue(exportModeAtom);
  const exportFolderId = useAtomValue(exportFolderIdAtom);
  const storedMultiOpts = useAtomValue(exportOptionsMultiDocAtom);
  const multiOpts: OptionsMultiDocument = {
    ...OPTIONS_MULTI_DOC_DEFAUT,
    ...storedMultiOpts,
  };
  const activeNoteFolder = useAtomValue(activeNoteFolderAtom);
  const allFolders = useAtomValue(allFoldersAtom);

  const [pages, setPages] = useState<(string | null)[]>([]);
  const [recompilation, setRecompilation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  function nomFichierDefaut(): string {
    if (exportMode === "dossier") {
      const folder = allFolders.find(
        (f) => f.id === (exportFolderId ?? activeNoteFolder?.id)
      );
      return folder?.name ?? "compilation";
    }
    return activeNote?.name ?? "export";
  }

  function construireTypst(): string | null {
    if (exportMode === "dossier") {
      const folderId = exportFolderId ?? activeNoteFolder?.id;
      const folder = allFolders.find((f) => f.id === folderId);
      if (!folder) return null;
      return compilerDossierVersTypst(
        folder,
        vaultPath,
        options,
        multiOpts,
        infoAuteur
      );
    }
    const editor = activeEditorRef.current;
    if (!editor || !activeNote) return null;
    let typst = "";
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      typst = proseMirrorDocVersTypst(
        view.state.doc,
        activeNote.name,
        vaultPath,
        options,
        infoAuteur
      );
    });
    return typst;
  }

  useEffect(() => {
    type PagePayload = {
      request_id: number;
      page_idx: number;
      total: number;
      svg: string;
    };
    type ErreurPayload = { request_id: number; message: string };

    const unlistens = [
      listen<PagePayload>("apercu_page", ({ payload }) => {
        if (payload.request_id !== requestIdRef.current) return;
        setPages((prev) => {
          const next =
            prev.length === payload.total
              ? [...prev]
              : Array<string | null>(payload.total).fill(null);
          next[payload.page_idx] = payload.svg;
          return next;
        });
        if (payload.page_idx === payload.total - 1) setRecompilation(false);
      }),
      listen<ErreurPayload>("apercu_erreur", ({ payload }) => {
        if (payload.request_id !== requestIdRef.current) return;
        setErreur(payload.message);
        setRecompilation(false);
      }),
    ];
    return () => {
      // biome-ignore lint/complexity/noForEach: tableau de Promises — for...of ne convient pas ici
      unlistens.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  function compilerApercu() {
    const typst = construireTypst();
    if (!typst) return;
    const id = ++requestIdRef.current;
    setRecompilation(true);
    setErreur(null);
    invoke("compiler_typst_apercu", {
      contenuTypst: typst,
      requestId: id,
    }).catch((e) => {
      if (id === requestIdRef.current) {
        setErreur(String(e));
        setRecompilation(false);
      }
    });
  }

  const compilerRef = useRef(compilerApercu);
  compilerRef.current = compilerApercu;

  useEffect(() => {
    if (open) compilerRef.current();
  }, [open]);

  const skipFirstOptions = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: compilerRef.current change sans changer la ref elle-même
  useEffect(() => {
    if (skipFirstOptions.current) {
      skipFirstOptions.current = false;
      return;
    }
    if (!open) return;
    compilerRef.current();
  }, [storedOptions, storedMultiOpts, exportMode, exportFolderId, open]);

  async function exporterPDF() {
    const typst = construireTypst();
    if (!typst) return;
    const chemin = await save({
      defaultPath: `${nomFichierDefaut()}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!chemin) return;
    setRecompilation(true);
    setErreur(null);
    try {
      await invoke("exporter_pdf", {
        contenuTypst: typst,
        cheminDest: chemin,
      });
      setToast("PDF exporté avec succès");
    } catch (e) {
      setErreur(String(e));
    } finally {
      setRecompilation(false);
    }
  }

  async function exporterTypst() {
    const typst = construireTypst();
    if (!typst) return;
    const chemin = await save({
      defaultPath: `${nomFichierDefaut()}.typ`,
      filters: [{ name: "Typst", extensions: ["typ"] }],
    });
    if (!chemin) return;
    try {
      await invoke("exporter_typst", {
        contenuTypst: typst,
        cheminDest: chemin,
      });
      setToast("Source Typst exporté avec succès");
    } catch (e) {
      setErreur(String(e));
    }
  }

  return {
    pages,
    recompilation,
    erreur,
    compilerApercu,
    exporterPDF,
    exporterTypst,
  };
}
