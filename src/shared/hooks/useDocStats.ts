// Calcule en différé le nombre de pages équivalent + le nombre de mots de la
// note active, à partir du document ProseMirror courant (activeEditorRef).
// Recalcul debounced pour rester léger pendant la frappe.

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { activeEditorRef } from "../components/NoteEditor/lib/activeEditorRef";
import { activeNoteAtom, pageFormatAtom } from "../lib/atoms";
import { NoteType } from "../lib/noteTypes";
import { countWords, measurePages } from "../lib/pageMetrics";
import { getCleanContentHTML, getPlainText } from "../lib/proseExport";

const DEBOUNCE_MS = 600;

export interface DocStats {
  pages: number;
  words: number;
}

export function useDocStats(): DocStats | null {
  const activeNote = useAtomValue(activeNoteAtom);
  const pageFormat = useAtomValue(pageFormatAtom);
  const [stats, setStats] = useState<DocStats | null>(null);

  // Ne calcule que pour les vraies notes (pas bases/dossiers)
  const isNote =
    activeNote?.type === NoteType.NOTE || activeNote?.type === null;

  useEffect(() => {
    if (!activeNote || !isNote) {
      setStats(null);
      return;
    }
    // activeNote change d'identité à chaque frappe (arbre immuable) → recalcul
    // debounced automatique. Lecture du document via activeEditorRef (non réactif).
    const timer = setTimeout(() => {
      const editor = activeEditorRef.current;
      if (!editor) return;
      const words = countWords(getPlainText(editor));
      const pages = measurePages(getCleanContentHTML(editor), pageFormat);
      setStats({ pages, words });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [activeNote, isNote, pageFormat]);

  return stats;
}
