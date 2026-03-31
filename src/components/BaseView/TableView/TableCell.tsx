import { useMemo, useRef, useState } from "react";
import type { Frontmatter, NoteFile } from "../../FileTree/hooks/useFileTree";
import { SystemField } from "../../../lib/noteTypes";
import {
  isFormula,
  computeFormula,
  humanizeFormula,
  dehumanizeFormula,
} from "../../../lib/formulas";
import { NoteSelector } from "../../Frontmatter/NoteSelector";
import {
  PropertySelector,
  type PropertyOption,
} from "../../Frontmatter/PropertySelector";

const REF_PROP_TRIGGER_RE = /ref\("([^"]+)"\)\.$/;

function getNoteProperties(note: NoteFile): PropertyOption[] {
  return Object.keys(note.frontmatter)
    .filter((k) => k !== SystemField.TYPE && k !== SystemField.CHILDREN)
    .map((key) => ({ key, displayName: key.replace(/^__|__$/g, "") }));
}

interface Props {
  value: string;
  isImposed: boolean;
  width: number;
  frontmatter: Frontmatter;
  noteResolver?: (path: string) => NoteFile | undefined;
  allNotes?: NoteFile[];
  onCommit: (value: string) => void;
}

export function TableCell({
  value,
  isImposed,
  width,
  frontmatter,
  noteResolver,
  allNotes,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [refSelectorOpen, setRefSelectorOpen] = useState(false);
  const [propSelectorNote, setPropSelectorNote] = useState<NoteFile | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const selectorOpenRef = useRef(false);
  const triggerCursorRef = useRef(0);

  const notesByName = useMemo(
    () => new Map(allNotes?.map((n) => [n.name, n.id]) ?? []),
    [allNotes]
  );

  const formula = isFormula(value);

  function toRaw(displayed: string): string {
    return dehumanizeFormula(displayed, notesByName);
  }

  function toDisplay(raw: string): string {
    return noteResolver ? humanizeFormula(raw, noteResolver) : raw;
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
    selectorOpenRef.current = false;
    setRefSelectorOpen(false);
    setPropSelectorNote(null);
  }

  function checkTriggers(displayed: string, cursorPos: number) {
    const toCursor = displayed.slice(0, cursorPos);

    if (toCursor.endsWith("ref(")) {
      openRefSelector(cursorPos);
      return;
    }

    const propMatch = REF_PROP_TRIGGER_RE.exec(toCursor);
    if (propMatch && allNotes) {
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

  function startEdit() {
    if (isImposed) return;
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit(rawValue: string) {
    setEditing(false);
    resetSelectors();
    onCommit(rawValue);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !selectorOpenRef.current) commit(draft);
    if (e.key === "Escape") {
      if (selectorOpenRef.current) closeSelectors();
      else {
        setDraft(value);
        setEditing(false);
      }
    }
  }

  const displayValue = formula
    ? computeFormula(
        value,
        frontmatter as Record<string, unknown>,
        undefined,
        noteResolver
      )
    : value;
  const isError = displayValue === "#ERREUR";

  return (
    <div
      style={{ width }}
      className={`shrink-0 border-r border-gray-100 px-3 text-xs truncate last:border-none ${
        isImposed
          ? "cursor-default text-gray-300"
          : value
            ? "text-gray-700 cursor-text"
            : "text-gray-300 cursor-text"
      }`}
      onDoubleClick={startEdit}
    >
      {editing ? (
        <div className="relative">
          <input
            ref={inputRef}
            // biome-ignore lint/a11y/noAutofocus: focus intentionnel à l'ouverture de l'édition
            autoFocus
            value={toDisplay(draft)}
            onChange={(e) => {
              const displayed = e.target.value;
              const cursorPos = e.target.selectionStart ?? displayed.length;
              const toCursor = displayed.slice(0, cursorPos);
              const afterCursor = displayed.slice(cursorPos);

              // Auto-pair : $$ → $$|$$
              if (toCursor.endsWith("$$") && !afterCursor.startsWith("$$")) {
                const paired = `${toCursor}$$${afterCursor}`;
                setDraft(toRaw(paired));
                setTimeout(
                  () =>
                    inputRef.current?.setSelectionRange(cursorPos, cursorPos),
                  0
                );
                return;
              }

              checkTriggers(displayed, cursorPos);
              setDraft(toRaw(displayed));
            }}
            onBlur={() => {
              if (!selectorOpenRef.current) commit(draft);
            }}
            onKeyDown={handleKeyDown}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full bg-transparent outline-none text-gray-700 font-body rounded px-1 -mx-1"
          />
          {refSelectorOpen && allNotes && (
            <NoteSelector
              notes={allNotes}
              onSelect={(note) => {
                const cursor = triggerCursorRef.current;
                const current = inputRef.current?.value ?? toDisplay(draft);
                const before = current.slice(0, cursor - 4);
                const after = current.slice(cursor);
                const inserted = `ref("${note.name}")`;
                const newDisplayed = `${before}${inserted}${after}`;
                setDraft(toRaw(newDisplayed));
                closeSelectors();
                const newCursor = before.length + inserted.length;
                setTimeout(
                  () =>
                    inputRef.current?.setSelectionRange(newCursor, newCursor),
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
                const current = inputRef.current?.value ?? toDisplay(draft);
                const before = current.slice(0, cursor);
                const after = current.slice(cursor);
                const newDisplayed = `${before}${key}${after}`;
                setDraft(toRaw(newDisplayed));
                closeSelectors();
                const newCursor = cursor + key.length;
                setTimeout(
                  () =>
                    inputRef.current?.setSelectionRange(newCursor, newCursor),
                  0
                );
              }}
              onClose={closeSelectors}
              anchorRef={inputRef}
            />
          )}
        </div>
      ) : formula ? (
        <span
          className="flex items-center gap-1 text-gray-400"
          title={toDisplay(value)}
        >
          <span className="text-gray-300 font-mono text-[10px] leading-none">
            ƒ
          </span>
          <span className={isError ? "text-red-400" : undefined}>
            {displayValue || "—"}
          </span>
        </span>
      ) : (
        <span>{value || "—"}</span>
      )}
    </div>
  );
}
