import { useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  IconArrowClockwise,
  IconDocumentBadgePlus,
  IconFolder,
  IconFolderBadgePlus,
  IconMagnifyingglass,
} from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import type { TreeNode } from "../../../shared/hooks/useFileTree";
import { useNote } from "../../../shared/hooks/useNote";
import {
  activeNoteAtom,
  activeSpaceAtom,
  errorAtom,
  filteredTreeAtom,
  folderPathAtom,
  loadingAtom,
  searchAtom,
  treeAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { flattenTree } from "../../../shared/lib/fileTreeHelpers";
import { ROW_ACTIVE, ROW_INACTIVE } from "../FileTree/FileNode";
import { FileTree } from "../FileTree/FileTree";
import { SpaceSwitcher } from "./SpaceSwitcher";

const SLIDE_PX = 14;
const EXIT_MS = 130;
const ENTER_MS = 150;

export function SideBarResizable() {
  const [search, setSearch] = useAtom(searchAtom);
  const loading = useAtomValue(loadingAtom);
  const tree = useAtomValue(treeAtom);
  const filteredTree = useAtomValue(filteredTreeAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const error = useAtomValue(errorAtom);
  const activeNote = useAtomValue(activeNoteAtom);
  const activeSpace = useAtomValue(activeSpaceAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);

  const { pickFolder, reload } = useFileTree();
  const { handleCreateNote, handleCreateFolder, handleSelectNote } = useNote();
  const allNotes = useMemo(() => flattenTree(tree), [tree]);

  // ── Animation de transition entre espaces ──────────────────────────────────

  const [displayTree, setDisplayTree] = useState<TreeNode[]>(filteredTree);
  const [slideStyle, setSlideStyle] = useState<CSSProperties>({});
  const isAnimatingRef = useRef(false);
  // Toujours à jour pour être lisible dans les callbacks asynchrones
  const latestFilteredTreeRef = useRef<TreeNode[]>(filteredTree);
  latestFilteredTreeRef.current = filteredTree;

  const prevSpaceRef = useRef<string | null | undefined>(undefined);

  // Effet 1 — déclenche l'animation au changement d'espace.
  // Déclaré EN PREMIER pour que isAnimatingRef soit true avant l'effet 2 (même batch).
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const prevSpace = prevSpaceRef.current;

    // Premier montage : initialisation silencieuse
    if (prevSpace === undefined) {
      prevSpaceRef.current = activeSpace;
      setDisplayTree(latestFilteredTreeRef.current);
      return;
    }

    prevSpaceRef.current = activeSpace;

    const spaces = vaultConfig?.spaces ?? [];
    const keys: (string | null)[] = [null, ...spaces.map((s) => s.name)];
    const prevIdx = keys.indexOf(prevSpace ?? null);
    const currIdx = keys.indexOf(activeSpace ?? null);
    // exitSign < 0 → glisse à gauche ; exitSign > 0 → glisse à droite
    const exitSign = currIdx > prevIdx ? -1 : 1;

    isAnimatingRef.current = true;

    // Phase 1 : sortie de l'arbre courant
    setSlideStyle({
      transform: `translateX(${exitSign * SLIDE_PX}px)`,
      opacity: 0,
      transition: `transform ${EXIT_MS}ms ease-in, opacity ${EXIT_MS}ms ease-in`,
      pointerEvents: "none",
    });

    const t = setTimeout(() => {
      // Phase 2 : placement instantané du nouvel arbre côté opposé (sans transition)
      setDisplayTree(latestFilteredTreeRef.current);
      setSlideStyle({
        transform: `translateX(${-exitSign * SLIDE_PX}px)`,
        opacity: 0,
        transition: "none",
        pointerEvents: "none",
      });

      // Phase 3 : entrée (double rAF pour forcer un paint entre les deux états)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSlideStyle({
            transform: "translateX(0)",
            opacity: 1,
            transition: `transform ${ENTER_MS}ms ease-out, opacity ${ENTER_MS}ms ease-out`,
          });
          setTimeout(() => {
            setSlideStyle({});
            isAnimatingRef.current = false;
          }, ENTER_MS + 10);
        })
      );
    }, EXIT_MS + 10);

    return () => {
      clearTimeout(t);
      isAnimatingRef.current = false;
    };
  }, [activeSpace]); // vaultConfig/filteredTree accédés via refs — pas de dépendance voulue

  // Effet 2 — synchronise displayTree pendant l'état normal (notes ajoutées/supprimées).
  // L'effet 1 (déclaré avant) a déjà positionné isAnimatingRef à true dans le même batch.
  useEffect(() => {
    if (!isAnimatingRef.current) {
      setDisplayTree(filteredTree);
    }
  }, [filteredTree]);

  // ─────────────────────────────────────────────────────────────────────────

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
    <div className="relative flex flex-col h-full pt-7 overflow-clip">
      {/* ── Partie haute fixe ────────────────────────────── */}
      <div className="shrink-0 select-none">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 h-11">
          {/* Dossier actif */}
          <div className="flex items-center -ml-2">
            <button
              type="button"
              onClick={reload}
              aria-label="Recharger"
              title="Recharger"
              className="w-auto h-6 flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-200/50 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <IconArrowClockwise
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
              <IconFolder className="size-4 select-none" aria-hidden="true" />
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
              <IconDocumentBadgePlus
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
              <IconFolderBadgePlus
                className="size-4 select-none"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* Recherche */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 h-8 liquid-glass bg-white/40 rounded-full px-2.5 py-1.5 text-gray-700 transition-colors">
            <IconMagnifyingglass className="size-4" aria-hidden="true" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full outline-none text-gray-900 placeholder:text-gray-700 "
            />
            {/* TODO : remplacer par une icône */}
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-gray-700 hover:text-gray-900 text-lg cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Partie scrollable ─────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto scroll-thin py-2 pb-4"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)",
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
                <Squircle
                  radius={16}
                  key={note.id}
                  onClick={(e) => handleSelectNote(note, e.metaKey)}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectNote(note)}
                  className={`select-none flex flex-col gap-0.5 px-2 py-2 cursor-pointer transition-colors ${activeNote?.id === note.id ? ROW_ACTIVE : ROW_INACTIVE}`}
                >
                  <p className="text-xs font-medium truncate">{note.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {note.id
                      .replace(`${folderPath}/`, "")
                      .replace(`/${note.name}.md`, "") || "racine"}
                  </p>
                </Squircle>
              ))
            )}
          </div>
        )}

        {/* Arborescence avec animation de transition entre espaces */}
        {!loading && !error && !isSearching && (
          <div style={slideStyle}>
            <FileTree nodes={displayTree} activeId={activeNote?.id ?? null} />
          </div>
        )}
      </div>

      <SpaceSwitcher />
    </div>
  );
}
