import { sfXmark } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { type NoteFile, flattenTree } from "../../../shared/hooks/useFileTree";
import {
  mobileContextMenuAtom,
  mobileGoBackAtom,
  treeAtom,
} from "../../../shared/lib/Atoms";
import { createLogger } from "../../../shared/lib/logger";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "../Floating/FloatingComponent";
import { MobileContextMenu } from "../BottomSheet/MobileContextMenu";
import { NoteRow } from "../FileTree/NoteRow";

const log = createLogger("SearchView");

export function SearchView() {
  const [query, setQuery] = useState("");
  const tree = useAtomValue(treeAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const setContextMenu = useSetAtom(mobileContextMenuAtom);
  const allNotes = useMemo(() => flattenTree(tree), [tree]);
  const selectNote = useMobileSelectNote();
  const { keyboardHeight } = useKeyboardHeight();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allNotes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [allNotes, query]);

  function handleSelect(note: NoteFile) {
    log.info("sélection depuis recherche", { id: note.id });
    selectNote(note);
  }

  return (
    <>
      <MobileContextMenu />
      <div
        className="fixed inset-0 z-30 flex flex-col bg-white overscroll-none"
        style={{
          paddingBottom:
            keyboardHeight > 0
              ? keyboardHeight
              : "max(env(safe-area-inset-bottom), 0px)",
        }}
      >
        {/* résultats : remplissent l'espace disponible */}
        <div className="flex-1 overflow-y-auto px-4 mt-15">
          {query.trim().length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              Tapez pour rechercher
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              Aucun résultat
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  onSelect={handleSelect}
                  onLongPress={() =>
                    setContextMenu({
                      id: note.id,
                      name: note.name,
                      isFolder: false,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* barre de recherche : collée en bas de la zone visible */}
        <div className="w-full flex px-4 pt-3 pb-3 gap-3">
          <FloatingComponent className="flex-1">
            <input
              // biome-ignore lint/a11y/noAutofocus: On vient de cliquer sur une fausse barre de recherche, c'est le comportement logique
              autoFocus
              contentEditable
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              enterKeyHint="search"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ fontSize: 16 }}
              className="flex-1 outline-none px-2"
            />
          </FloatingComponent>

          <FloatingComponent
            onClick={() => {
              hapticImpact("light");
              goBack();
            }}
            className="size-13 justify-center items-center"
          >
            <SFIcon icon={sfXmark} className="size-4.5" />
          </FloatingComponent>
        </div>
      </div>
    </>
  );
}
