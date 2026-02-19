import { sfArrowClockwise, sfDocumentBadgePlus, sfFolder, sfFolderBadgePlus, sfMagnifyingglass } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useMemo } from "react";
import { flattenTree, useFileTree } from "../hooks/useFileTree";
import { useNote } from "../hooks/useNote";
import { useAtom, useAtomValue } from "jotai";
import { activeNoteAtom, errorAtom, folderPathAtom, loadingAtom, searchAtom, treeAtom } from "../lib/Atoms";
import { FileTree } from "./FileTree";
import { useState, useRef, useCallback } from "react";

function SideBarInside() {
    const [search, setSearch] = useAtom(searchAtom);
    const loading = useAtomValue(loadingAtom);
    const tree = useAtomValue(treeAtom);
    const folderPath = useAtomValue(folderPathAtom);
    const error = useAtomValue(errorAtom);
    const activeNote = useAtomValue(activeNoteAtom);

    const { pickFolder, reload } = useFileTree();
    const { handleCreateNote, handleCreateFolder, handleSelectNote } = useNote();
    const allNotes = useMemo(() => flattenTree(tree), [tree]);

    const searchResults = useMemo(() => {
        if (!search.trim()) return [];
        const q = search.toLowerCase();
        return allNotes.filter(
            (n) =>
                n.name.toLowerCase().includes(q) ||
                n.content.toLowerCase().includes(q),
        );
    }, [allNotes, search]);

    const isSearching = search.trim().length > 0;

    return (
        <aside className="w-full shrink-0 flex flex-col bg-gray-50 border-r border-gray-200 overflow-hidden">

            {/* En-tête */}
            <div className="flex items-center justify-between px-4 h-11 border-b border-gray-200 shrink-0">
                <span className="font-semibold text-gray-800 tracking-tight">Lueurs</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={pickFolder}
                        aria-label="Changer de dossier"
                        title="Changer de dossier"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfFolder} className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={reload}
                        aria-label="Recharger"
                        title="Recharger"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfArrowClockwise} className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateNote}
                        aria-label="Nouvelle note à la racine"
                        title="Nouvelle note"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfDocumentBadgePlus} className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateFolder}
                        aria-label="Nouveau dossier à la racine"
                        title="Nouveau dossier"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                        <SFIcon icon={sfFolderBadgePlus} className="size-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Dossier actif */}
            <div className="px-4 py-1.5 border-b border-gray-200 shrink-0">
                <p className="text-xs text-gray-400 truncate" title={folderPath ? folderPath : "Aucun dossier sélectionné"}>
                    {folderPath?.split("/").pop()}
                </p>
            </div>

            {/* Recherche */}
            <div className="px-3 py-2 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-400 focus-within:border-gray-400 transition-colors">
                    <SFIcon icon={sfMagnifyingglass} className="size-4" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-xs text-gray-700 placeholder:text-gray-400"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="Effacer la recherche"
                            className="text-gray-300 hover:text-gray-500 text-xs transition-colors cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Contenu : résultats de recherche ou arbre */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <p className="px-4 py-4 text-xs text-center text-gray-400">
                        Chargement...
                    </p>
                )}
                {error && (
                    <p className="px-4 py-4 text-xs text-center text-red-400">{error}</p>
                )}

                {/* Résultats de recherche (liste plate) */}
                {!loading && !error && isSearching && (
                    <div className="px-2 py-2 space-y-0.5">
                        {searchResults.length === 0 ? (
                            <p className="px-2 py-4 text-xs text-center text-gray-400">
                                Aucun résultat
                            </p>
                        ) : (
                            searchResults.map((note) => (
                                <div
                                    key={note.id}
                                    onClick={() => handleSelectNote(note)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSelectNote(note)}
                                    className={`flex flex-col gap-0.5 rounded-md px-2 py-2 cursor-pointer transition-colors ${activeNote?.id === note.id
                                        ? "bg-white shadow-sm border border-gray-200"
                                        : "hover:bg-gray-100"
                                        }`}
                                >
                                    <p className="text-xs font-medium text-gray-800 truncate">
                                        {note.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                        {note.id.replace(`${folderPath}/`, "").replace(`/${note.name}.md`, "") || "racine"}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Arborescence */}
                {!loading && !error && !isSearching && (
                    <FileTree
                        nodes={tree}
                        activeId={activeNote?.id ?? null}
                    />
                )}
            </div>
        </aside>
    )
}

function SideBar() {
    const [width, setWidth] = useState(240);
    const isResizing = useRef(false);

    const startResize = useCallback((e: React.MouseEvent) => {
        isResizing.current = true;
        e.preventDefault();

        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newWidth = Math.min(Math.max(e.clientX, 160), 480);
            setWidth(newWidth);
        };

        const onMouseUp = () => {
            isResizing.current = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, []);

    return (
        <aside
            className="shrink-0 flex flex-col bg-gray-50 border-r border-gray-200 overflow-hidden relative"
            style={{ width }}
        >
            <SideBarInside />

            {/* Handle de redimensionnement */}
            <div
                onMouseDown={startResize}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-200 transition-colors z-10 rounded-full my-3"
            />
        </aside>
    );
}

export { SideBar };