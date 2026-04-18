import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { type NoteFile, flattenTree } from "../../shared/hooks/useFileTree";
import {
  mobileViewAtom,
  renameTargetAtom,
  treeAtom,
} from "../../shared/lib/Atoms";
import { createLogger } from "../../shared/lib/logger";
import { NoteRow } from "./MobileFileTree/NoteRow";
import { FloatingComponent } from "./FloatingComponent";
import { sfXmark } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useMobileSelectNote } from "../hooks/useMobileSelectNote";

const log = createLogger("SearchView");

export function SearchView() {
  const [query, setQuery] = useState("");
  const tree = useAtomValue(treeAtom);
  const setView = useSetAtom(mobileViewAtom);
  const setRenameTarget = useSetAtom(renameTargetAtom);
  const allNotes = useMemo(() => flattenTree(tree), [tree]);
  const selectNote = useMobileSelectNote();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allNotes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [allNotes, query]);

  const [vvHeight, setVvHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  );
  const [vvOffsetTop, setVvOffsetTop] = useState(
    () => window.visualViewport?.offsetTop ?? 0
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      setVvHeight(vv.height);
      setVvOffsetTop(vv.offsetTop);
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);

  function handleSelect(note: NoteFile) {
    log.info("sélection depuis recherche", { id: note.id });
    selectNote(note);
  }

  return (
    <div
      className="fixed left-0 z-30 flex flex-col bg-white overscroll-none"
      style={{
        top: vvOffsetTop,
        width: "100%",
        height: vvHeight,
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
                onLongPress={() => {
                  const id = note.id;
                  const name = note.name;
                  setRenameTarget({ id, name, isFolder: false });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* barre de recherche : collée en bas du visual viewport */}
      <div className="w-full flex px-4 pb-5 gap-3">
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
          onClick={() => setView("filetree")}
          className="size-13 justify-center items-center"
        >
          <SFIcon icon={sfXmark} className="size-4.5" />
        </FloatingComponent>
      </div>
    </div>
  );
}
