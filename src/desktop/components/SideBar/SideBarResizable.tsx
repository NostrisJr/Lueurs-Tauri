import {
  sfArrowClockwise,
  sfDocumentBadgePlus,
  sfFolder,
  sfFolderBadgePlus,
  sfMagnifyingglass,
  sfSidebarLeft,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useAtom, useAtomValue } from "jotai";
import { useMemo } from "react";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteAtom,
  errorAtom,
  folderPathAtom,
  loadingAtom,
  searchAtom,
  sidebarCollapsedAtom,
  treeAtom,
} from "../../../shared/lib/Atoms";
import { flattenTree } from "../../../shared/lib/fileTreeHelpers";
import { ROW_ACTIVE, ROW_INACTIVE } from "../FileTree/FileNode";
import { FileTree } from "../FileTree/FileTree";

export function SideBarResizable({ onToggle }: { onToggle: () => void }) {
  const [search, setSearch] = useAtom(searchAtom);
  const loading = useAtomValue(loadingAtom);
  const tree = useAtomValue(treeAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const error = useAtomValue(errorAtom);
  const activeNote = useAtomValue(activeNoteAtom);
  const sideBarCollapsed = useAtomValue(sidebarCollapsedAtom);

  const { pickFolder, reload } = useFileTree();
  const { handleCreateNote, handleCreateFolder, handleSelectNote } = useNote();
  const allNotes = useMemo(() => flattenTree(tree), [tree]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allNotes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [allNotes, search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="relative flex flex-col h-full pt-7 overflow-clip [overflow-clip-margin:8px]">
      {/* ── Partie haute fixe ────────────────────────────── */}
      <div className="shrink-0 select-none">
        {/* collapse la sidebar */}
        <button
          className={`absolute z-100 top-1 right-3 text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 rounded-full transition-opacity duration-300 ${sideBarCollapsed ? "opacity-0" : "opacity-100"}`}
          type="button"
          onClick={onToggle}
          aria-label="Réduire la sidebar"
          title="Réduire"
        >
          <SFIcon icon={sfSidebarLeft} className="size-5" aria-hidden="true" />
        </button>
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 h-11">
          {/* Dossier actif */}
          <div className="flex items-center -ml-2">
            {/* TODO: extraire un composant */}
            <button
              type="button"
              onClick={reload}
              aria-label="Recharger"
              title="Recharger"
              className="w-auto h-6 flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <SFIcon
                icon={sfArrowClockwise}
                className="size-4 select-none"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={pickFolder}
              aria-label="Changer de dossier"
              title="Changer de dossier"
              className="w-auto h-6 flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <SFIcon
                icon={sfFolder}
                className="size-4 select-none"
                aria-hidden="true"
              />
            </button>

            <p
              className="text-xs text-gray-400 truncate"
              title={folderPath ?? "Aucun dossier sélectionné"}
            >
              {folderPath?.split("/").pop()}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreateNote}
              aria-label="Nouvelle note à la racine"
              title="Nouvelle note"
              className="w-auto h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 transition-colors cursor-pointer"
            >
              <SFIcon
                icon={sfDocumentBadgePlus}
                className="size-4 select-none"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={handleCreateFolder}
              aria-label="Nouveau dossier à la racine"
              title="Nouveau dossier"
              className="w-auto h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 transition-colors cursor-pointer"
            >
              <SFIcon
                icon={sfFolderBadgePlus}
                className="size-4 select-none"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* Recherche */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 h-8 liquid-glass bg-white/40 rounded-full px-2.5 py-1.5 text-gray-700 transition-colors">
            <SFIcon
              icon={sfMagnifyingglass}
              className="size-4"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full outline-none text-gray-900 placeholder:text-gray-700 "
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-gray-700 hover:text-gray-900 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Partie scrollable ─────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto scroll-thin py-2"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0px, black 20px, black calc(100% - 36px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0px, black 20px, black calc(100% - 36px), transparent 100%)",
        }}
      >
        {loading && (
          <p className="px-4 py-4 text-xs text-center text-gray-400">
            Chargement...
          </p>
        )}
        {error && (
          <p className="px-4 py-4 text-xs text-center text-red-400">{error}</p>
        )}

        {!loading && !error && isSearching && (
          <div className="px-2 py-2 space-y-0.5">
            {searchResults.length === 0 ? (
              <p className="px-2 py-4 text-xs text-center text-gray-400">
                Aucun résultat
              </p>
            ) : (
              searchResults.map((note) => (
                //TODO :
                <div
                  key={note.id}
                  onClick={(e) => handleSelectNote(note, e.metaKey)}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectNote(note)}
                  className={`select-none flex flex-col gap-0.5 rounded-lg px-2 py-2 cursor-pointer transition-colors ${activeNote?.id === note.id ? ROW_ACTIVE : ROW_INACTIVE}`}
                >
                  <p className="text-xs font-medium truncate">{note.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {note.id
                      .replace(`${folderPath}/`, "")
                      .replace(`/${note.name}.md`, "") || "racine"}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Arborescence */}
        {!loading && !error && !isSearching && (
          <FileTree nodes={tree} activeId={activeNote?.id ?? null} />
        )}
      </div>
    </div>
  );
}
