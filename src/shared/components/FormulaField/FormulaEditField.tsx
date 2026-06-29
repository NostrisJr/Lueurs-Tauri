import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoteSelector } from "../../../desktop/components/Frontmatter/NoteSelector";
import { PropertySelector } from "../../../desktop/components/Frontmatter/PropertySelector";
import {
  REF_PROP_TRIGGER_RE,
  getNoteProperties,
} from "../../../desktop/components/Frontmatter/lib/frontmatterUtils";
import type { NoteFile } from "../../hooks/useFileTree";
import { dehumanizeFormula, humanizeFormula } from "../../lib/formulas";

interface Props {
  /** Formule brute `$$…$$` avec chemins absolus dans ref(). */
  rawValue: string;
  /** Appelé à chaque édition avec la formule brute (dehumanisée). */
  onChange: (raw: string) => void;
  /** Fin d'édition (Entrée hors sélecteur, ou Échap sans sélecteur ouvert). */
  onDone: () => void;
  allNotes: NoteFile[];
  noteResolver: (path: string) => NoteFile | undefined;
  autoFocus?: boolean;
  inputClassName?: string;
  /** Position du caret à l'ouverture (ex: entre les `$$` d'une formule vide). */
  initialCursor?: number;
}

/**
 * Champ d'édition d'une formule humanisée, partagé entre le frontmatter
 * (FrontmatterValue) et le popup d'édition des formules inline du corps.
 * L'utilisateur voit/édite la version humanisée (ref("Nom")), le stockage reste
 * en chemins absolus. Déclencheurs `ref(` → NoteSelector, `ref("…").` → PropertySelector.
 */
export function FormulaEditField({
  rawValue,
  onChange,
  onDone,
  allNotes,
  noteResolver,
  autoFocus = true,
  inputClassName,
  initialCursor,
}: Props) {
  const isMobile = platform() === "ios";
  const inputRef = useRef<HTMLInputElement>(null);

  // Place le caret à l'ouverture (formule vide : entre les `$$`). Une seule fois.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ouverture uniquement
  useEffect(() => {
    if (initialCursor == null) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(initialCursor, initialCursor);
  }, []);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  const [propSelectorNote, setPropSelectorNote] = useState<NoteFile | null>(
    null
  );

  const notesByName = useMemo(
    () => new Map(allNotes.map((n) => [n.name, n.id])),
    [allNotes]
  );

  const displayValue = humanizeFormula(rawValue, noteResolver);

  function toRaw(displayed: string): string {
    return dehumanizeFormula(displayed, notesByName);
  }

  function openRefSelector(cursorPos: number) {
    triggerCursorRef.current = cursorPos;
    selectorOpenRef.current = true;
    setRefSelectorOpen(true);
    setPropSelectorNote(null);
  }

  function openPropSelector(note: NoteFile, cursorPos: number) {
    triggerCursorRef.current = cursorPos;
    selectorOpenRef.current = true;
    setPropSelectorNote(note);
    setRefSelectorOpen(false);
  }

  function closeSelectors() {
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropSelectorNote(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function resetSelectors() {
    // Ferme sans redonner le focus (l'input l'a déjà).
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropSelectorNote(null);
  }

  /** Vérifie les déclencheurs sur le texte jusqu'au curseur. */
  function checkTriggers(displayed: string, cursorPos: number) {
    const toCursor = displayed.slice(0, cursorPos);

    if (toCursor.endsWith("ref(")) {
      openRefSelector(cursorPos);
      return;
    }

    const propMatch = REF_PROP_TRIGGER_RE.exec(toCursor);
    if (propMatch) {
      const nameOrPath = propMatch[1];
      const note = allNotes.find(
        (n) => n.name === nameOrPath || n.id === nameOrPath
      );
      if (note) {
        openPropSelector(note, cursorPos);
        return;
      }
    }

    resetSelectors();
  }

  /** Insère du texte en remplaçant `charsToRemoveBefore` caractères avant le curseur. */
  function insertAtCursor(
    displayed: string,
    cursorPos: number,
    inserted: string,
    charsToRemoveBefore: number
  ): { newDisplayed: string; newCursor: number } {
    const before = displayed.slice(0, cursorPos - charsToRemoveBefore);
    const after = displayed.slice(cursorPos);
    return {
      newDisplayed: `${before}${inserted}${after}`,
      newCursor: before.length + inserted.length,
    };
  }

  return (
    <div className="flex-1 relative">
      <input
        ref={inputRef}
        // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition formule
        autoFocus={autoFocus}
        value={displayValue}
        onChange={(e) => {
          const displayed = e.target.value;
          const cursorPos = e.target.selectionStart ?? displayed.length;
          checkTriggers(displayed, cursorPos);
          onChange(toRaw(displayed));
        }}
        onBlur={() => {
          if (!selectorOpenRef.current) onDone();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            // preventDefault : sinon le focus rendu à l'éditeur fait suivre le
            // keypress vers ProseMirror (saut de ligne parasite).
            e.preventDefault();
            if (selectorOpenRef.current) closeSelectors();
            else onDone();
          }
          if (e.key === "Enter" && !selectorOpenRef.current) {
            e.preventDefault();
            onDone();
          }
        }}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        style={isMobile ? { fontSize: 14 } : undefined}
        className={
          inputClassName ??
          "w-full mt-0.5 bg-transparent outline-none border-b border-gray-300 text-gray-600 focus:border-gray-300 transition-colors font-mono"
        }
      />

      {refSelectorOpen && (
        <NoteSelector
          notes={allNotes}
          onSelect={(note) => {
            const cursor = triggerCursorRef.current;
            const current = inputRef.current?.value ?? displayValue;
            const { newDisplayed, newCursor } = insertAtCursor(
              current,
              cursor,
              `ref("${note.name}")`,
              4 /* "ref(" */
            );
            onChange(toRaw(newDisplayed));
            closeSelectors();
            setTimeout(
              () => inputRef.current?.setSelectionRange(newCursor, newCursor),
              0
            );
          }}
          onClose={closeSelectors}
          anchorRef={inputRef}
          placeholder="Référencer une note..."
        />
      )}

      {propSelectorNote && (
        <PropertySelector
          options={getNoteProperties(propSelectorNote)}
          onSelect={(key) => {
            const cursor = triggerCursorRef.current;
            const current = inputRef.current?.value ?? displayValue;
            const { newDisplayed, newCursor } = insertAtCursor(
              current,
              cursor,
              key,
              0 /* après le "." déjà là */
            );
            onChange(toRaw(newDisplayed));
            closeSelectors();
            setTimeout(
              () => inputRef.current?.setSelectionRange(newCursor, newCursor),
              0
            );
          }}
          onClose={closeSelectors}
          anchorRef={inputRef}
        />
      )}
    </div>
  );
}
