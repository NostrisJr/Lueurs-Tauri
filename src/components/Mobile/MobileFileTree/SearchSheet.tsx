import { useState, useRef, useMemo } from "react";
import { useAtomValue } from "jotai";
import { treeAtom } from "../../../lib/atoms.ts";
import { flattenTree, type NoteFile } from "../../FileTree/hooks/useFileTree";
import { BottomSheet } from "../BottomSheet";
import { NoteRow } from "./NoteRow";

interface Props {
  onClose: () => void;
  onSelectNote: (note: NoteFile) => void;
  onRenameNote: (id: string, name: string) => void;
}

export function SearchSheet({ onClose, onSelectNote, onRenameNote }: Props) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tree = useAtomValue(treeAtom);
  const allNotes = useMemo(() => flattenTree(tree), [tree]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allNotes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [allNotes, search]);

  // Focus auto à l'ouverture
  setTimeout(() => inputRef.current?.focus(), 300);

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-4 pt-1 pb-2 shrink-0 border-b border-gray-100">
        <input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{ fontSize: 16 }}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 outline-none focus:border-blue-400 transition-colors"
        />
      </div>
      <div className="overflow-y-auto flex-1 px-3 py-2" data-scrollable>
        {search.trim().length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Tapez pour rechercher
          </p>
        ) : searchResults.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Aucun résultat
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {searchResults.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                onSelect={(n) => {
                  onClose();
                  onSelectNote(n);
                }}
                onLongPress={() => {
                  onClose();
                  onRenameNote(note.id, note.name);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
