import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoteSelector } from "../../../desktop/components/Frontmatter/NoteSelector";
import { PropertySelector } from "../../../desktop/components/Frontmatter/PropertySelector";
import {
  type PropertyOption,
  REF_PROP_TRIGGER_RE,
  SELF_PROP_TRIGGER_RE,
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
  /** Propriétés de la note courante — auto-complétion de `self.`. */
  selfProperties?: PropertyOption[];
  /**
   * Chemin à stocker dans `ref()` pour une note. Absolu dans le frontmatter,
   * relatif au vault dans le corps de note (cf. plugins/inline-formula/refPaths.ts).
   */
  refPathOf?: (note: NoteFile) => string;
}

// Identité stable : en défaut de paramètre, la fonction serait recréée à chaque
// render et invaliderait le mémo `notesByName` (reconstruction de la Map de
// toutes les notes du vault à chaque caractère tapé).
const noteIdPath = (note: NoteFile) => note.id;

/**
 * Champ d'édition d'une formule humanisée, partagé entre le frontmatter
 * (FrontmatterValue) et le popup d'édition des formules inline du corps.
 * L'utilisateur voit/édite la version humanisée (ref("Nom")), le stockage garde
 * un chemin (absolu dans le frontmatter, relatif au vault dans le corps — cf.
 * `refPathOf`). Déclencheurs : `ref(` → NoteSelector, `ref("…")[` et `self[` →
 * PropertySelector (le crochet, pas le point : la forme insérée est toujours
 * `["prop"]`, seule syntaxe robuste à un nom de propriété avec espaces).
 */
export function FormulaEditField({
  rawValue,
  onChange,
  onDone,
  allNotes,
  noteResolver,
  autoFocus = true,
  inputClassName,
  selfProperties,
  refPathOf = noteIdPath,
}: Props) {
  const isMobile = platform() === "ios";
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize : ajuste la hauteur au contenu, plafonné à ~4 lignes.
  const MAX_HEIGHT = isMobile ? 100 : 88;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  });

  // Caret en fin de formule à l'ouverture. Ce champ REMPLACE l'input texte du
  // frontmatter au moment où `$$x$$` devient une formule valide (et le popup
  // inline s'ouvre sur un autre élément DOM) : sans ça le caret retombe en
  // position 0 et le caractère suivant s'insère AVANT celui qu'on vient de taper.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  // Options du PropertySelector : propriétés d'une note référencée (`ref("…").`)
  // ou de la note courante (`self.`).
  const [propOptions, setPropOptions] = useState<PropertyOption[] | null>(null);

  const notesByName = useMemo(
    () => new Map(allNotes.map((n) => [n.name, refPathOf(n)])),
    [allNotes, refPathOf]
  );

  const inner = rawValue.replace(/^\$\$/, "").replace(/\$\$$/, "");
  const displayValue = humanizeFormula(inner, noteResolver);

  function toRaw(displayed: string): string {
    return `$$${dehumanizeFormula(displayed, notesByName)}$$`;
  }

  function openRefSelector(cursorPos: number) {
    triggerCursorRef.current = cursorPos;
    selectorOpenRef.current = true;
    setRefSelectorOpen(true);
    setPropOptions(null);
  }

  function openPropSelector(options: PropertyOption[], cursorPos: number) {
    triggerCursorRef.current = cursorPos;
    selectorOpenRef.current = true;
    setPropOptions(options);
    setRefSelectorOpen(false);
  }

  function closeSelectors() {
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropOptions(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function resetSelectors() {
    // Ferme sans redonner le focus (l'input l'a déjà).
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropOptions(null);
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
        openPropSelector(getNoteProperties(note), cursorPos);
        return;
      }
    }

    if (selfProperties?.length && SELF_PROP_TRIGGER_RE.test(toCursor)) {
      openPropSelector(selfProperties, cursorPos);
      return;
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
      <textarea
        ref={inputRef}
        // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition formule
        autoFocus={autoFocus}
        value={displayValue}
        rows={1}
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
            // Échap ferme le sélecteur s'il est ouvert, sinon VALIDE la formule
            // (comme Entrée) — ce n'est volontairement pas un « annuler ». Le
            // brouillon local rendrait l'annulation triviale à écrire : c'est un
            // choix de comportement, pas une limite technique. Ne pas « corriger ».
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
        style={{ resize: "none", ...(isMobile ? { fontSize: 16 } : {}) }}
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

      {propOptions && (
        <PropertySelector
          options={propOptions}
          onSelect={(key) => {
            const cursor = triggerCursorRef.current;
            const current = inputRef.current?.value ?? displayValue;
            // Le "[" qui a déclenché le sélecteur est déjà tapé (self[ / ref("…")[) :
            // on ne complète que le reste, ce qui donne self["clé"] / ref("…")["clé"].
            const { newDisplayed, newCursor } = insertAtCursor(
              current,
              cursor,
              `${JSON.stringify(key)}]`,
              0
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
