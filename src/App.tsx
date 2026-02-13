import { useState, useMemo } from "react";
import { MilkdownEditor } from "./components/MilkdownEditor";
import { useFileTree, flattenTree } from "./hooks/useFileTree";
import type { NoteFile } from "./hooks/useFileTree";
import { FileTree } from "./components/FileTree";

// ── Icônes ────────────────────────────────────────────────────────────────────

const IconSearch = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <title>Rechercher</title>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const IconPlus = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <title>Nouvelle note</title>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconRefresh = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <title>Recharger</title>
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const IconFolder = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <title>Choisir un dossier</title>
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const IconSaved = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <title>Sauvegardé</title>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Écran de bienvenue ────────────────────────────────────────────────────────

function WelcomeScreen({ onPick }: { onPick: () => void }) {
  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
          <IconFolder />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Aucun dossier sélectionné</p>
          <p className="text-sm text-gray-400 mt-1">
            Choisis un dossier contenant tes fichiers&nbsp;.md
          </p>
        </div>
        <button
          type="button"
          onClick={onPick}
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
        >
          Choisir un dossier
        </button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const {
    folderPath,
    tree,
    loading,
    error,
    pickFolder,
    reload,
    createNote,
    createFolder,
    updateNote,
    deleteNote,
  } = useFileTree();

  const [activeNote, setActiveNote] = useState<NoteFile | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Aplatit l'arbre pour la recherche
  const allNotes = useMemo(() => flattenTree(tree), [tree]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
    );
  }, [allNotes, search]);

  const isSearching = search.trim().length > 0;

  async function handleCreate() {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const targetDir = folderPath!;
    const filePath = await createNote(targetDir);
    // Sélectionne la nouvelle note après rechargement
    const newNote = allNotes.find((n) => n.id === filePath);
    if (newNote) setActiveNote(newNote);
  }

  function handleChange(markdown: string) {
    if (!activeNote) return;
    setSaving(true);
    updateNote(activeNote.id, markdown);
    // L'indicateur "saving" s'éteint après le debounce + un peu de marge
    setTimeout(() => setSaving(false), 1200);
  }

  function handleSelectNote(note: NoteFile) {
    setActiveNote(note);
    setSearch("");
  }

  async function handleDeleteNote(fileId: string) {
    await deleteNote(fileId);
    if (activeNote?.id === fileId) setActiveNote(null);
  }

  if (!folderPath) return <WelcomeScreen onPick={pickFolder} />;

  return (
    <div className="h-screen flex bg-white text-gray-900 overflow-hidden text-sm">

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col bg-gray-50 border-r border-gray-200 overflow-hidden">

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
              <IconFolder />
            </button>
            <button
              type="button"
              onClick={reload}
              aria-label="Recharger"
              title="Recharger"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <IconRefresh />
            </button>
            <button
              type="button"
              onClick={handleCreate}
              aria-label="Nouvelle note à la racine"
              title="Nouvelle note"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <IconPlus />
            </button>
          </div>
        </div>

        {/* Dossier actif */}
        <div className="px-4 py-1.5 border-b border-gray-200 shrink-0">
          <p className="text-xs text-gray-400 truncate" title={folderPath}>
            {folderPath.split("/").pop()}
          </p>
        </div>

        {/* Recherche */}
        <div className="px-3 py-2 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-400 focus-within:border-gray-400 transition-colors">
            <IconSearch />
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
                      {note.title}
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
              onSelectNote={handleSelectNote}
              onCreateNote={createNote}
              onCreateFolder={createFolder}
              onDeleteNote={handleDeleteNote}
              rootPath={folderPath}
            />
          )}
        </div>
      </aside>

      {/* ── Éditeur ───────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">

        {/* Barre de statut */}
        {activeNote && (
          <div className="flex items-center justify-end px-4 h-8 border-b border-gray-100 shrink-0">
            <span
              className={`flex items-center gap-1.5 text-xs transition-opacity ${saving ? "text-gray-400 opacity-100" : "text-gray-300 opacity-60"
                }`}
            >
              <IconSaved />
              {saving ? "Sauvegarde..." : "Sauvegardé"}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {activeNote ? (
            <MilkdownEditor
              key={activeNote.id}
              value={activeNote.content}
              onChange={handleChange}
              className="h-full"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-400">
                {loading ? "Chargement..." : "Sélectionne ou crée une note"}
              </p>
              {!loading && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Créer une note
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}