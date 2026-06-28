/**
 * WikilinkEditPopup.tsx
 *
 * Popup d'édition/insertion de lien, déclenché par le menu contextuel, l'appui
 * long ou Mod-K. Réutilise l'autocomplétion de notes (useWikilinkCandidates) avec
 * son propre champ de recherche + un champ alias. Note ou URL : insère un lien
 * markdown standard (mark `link`) — href = chemin relatif vault, ou URL.
 */

import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { createLogger } from "../../lib/logger";
import {
  getWikilinkEdit,
  setWikilinkEdit,
  subscribeWikilinkEdit,
} from "../../plugins/wikilink/wikilinkEditState";
import {
  type WikilinkCandidate,
  useWikilinkCandidates,
} from "./hooks/useWikilinkCandidates";
import { activeEditorRef } from "./lib/activeEditorRef";
import { scrollPosIntoViewLikeEditing } from "./lib/editorScroll";
import { clampPopup } from "./lib/popupPosition";

const POPUP_WIDTH = 320;
const POPUP_EST_HEIGHT = 300;

const log = createLogger("WikilinkEditPopup");

const URL_RE = /^(https?:\/\/|mailto:|www\.)/i;

type Row =
  | { kind: "web"; href: string; label: string }
  | { kind: "note"; candidate: WikilinkCandidate };

interface Props {
  vaultPath: string;
}

export function WikilinkEditPopup({ vaultPath }: Props) {
  const request = useSyncExternalStore(
    subscribeWikilinkEdit,
    getWikilinkEdit,
    () => null
  );
  const [query, setQuery] = useState("");
  const [alias, setAlias] = useState("");
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // (Ré)initialise le formulaire à l'ouverture
  useEffect(() => {
    if (!request) return;
    setQuery(request.initialQuery);
    setAlias(request.initialAlias);
    setIndex(0);
    // Focus différé pour laisser le portail se monter
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [request]);

  // Calcule la position avant peinture. Sans `coords` imposées (desktop / Mod-K),
  // on scrolle la cible dans la vue puis on lit ses coordonnées écran — sinon une
  // cible hors viewport donnerait une ancre fausse.
  useLayoutEffect(() => {
    if (!request) {
      setPos(null);
      return;
    }
    if (request.coords) {
      setPos(clampPopup(request.coords, POPUP_WIDTH, POPUP_EST_HEIGHT));
      return;
    }
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      // Scroll avec les mêmes marges que la frappe (dégage le header en haut)
      scrollPosIntoViewLikeEditing(view, request.range.from);
      const c = view.coordsAtPos(request.range.from);
      setPos(clampPopup(c, POPUP_WIDTH, POPUP_EST_HEIGHT));
    });
  }, [request]);

  const candidates = useWikilinkCandidates(query, vaultPath);

  const isUrl = URL_RE.test(query.trim());
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = candidates.map((c) => ({ kind: "note", candidate: c }));
    if (isUrl) {
      const raw = query.trim();
      const href = raw.startsWith("www.") ? `https://${raw}` : raw;
      list.unshift({ kind: "web", href, label: raw });
    }
    return list;
  }, [candidates, isUrl, query]);

  const close = useCallback(() => setWikilinkEdit(null), []);

  const apply = useCallback(
    (row: Row) => {
      const editor = activeEditorRef.current;
      const req = getWikilinkEdit();
      if (!editor || !req) return;
      const aliasValue = alias.trim();
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const linkMark = schema.marks.link;
        if (!linkMark) return;
        const { from, to } = req.range;
        // Note → href = chemin relatif vault ; Web → href = URL
        const href = row.kind === "note" ? row.candidate.relpath : row.href;
        const text =
          aliasValue || (row.kind === "note" ? row.candidate.name : row.label);
        const textNode = view.state.schema.text(text, [
          linkMark.create({ href, title: "" }),
        ]);
        const tr = view.state.tr.replaceWith(from, to, textNode);
        tr.removeStoredMark(linkMark);
        view.dispatch(tr);
        view.focus();
        log.info("lien appliqué", { kind: row.kind, href });
      });
      close();
    },
    [alias, close]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        if (rows.length === 0) return;
        e.preventDefault();
        setIndex((i) => (i + 1) % rows.length);
        break;
      case "ArrowUp":
        if (rows.length === 0) return;
        e.preventDefault();
        setIndex((i) => (i - 1 + rows.length) % rows.length);
        break;
      case "Enter":
        if (rows.length === 0) return;
        e.preventDefault();
        apply(rows[Math.min(index, rows.length - 1)]);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  if (!request || !pos) return null;

  const safeIndex = Math.min(index, Math.max(rows.length - 1, 0));

  return createPortal(
    // Overlay pour fermer au clic extérieur
    <div className="fixed inset-0 z-50" onMouseDown={close}>
      <div
        className="absolute w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Note ou URL…"
          className="mb-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-amber-400"
        />
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Texte affiché (optionnel)"
          className="mb-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-amber-400"
        />
        <div className="max-h-60 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-2 py-2 text-xs italic text-gray-400">
              Aucune note correspondante
            </p>
          ) : (
            rows.map((row, i) => (
              <button
                key={row.kind === "web" ? "__web__" : row.candidate.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  apply(row);
                }}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm transition-colors ${
                  i === safeIndex ? "bg-amber-50" : "hover:bg-gray-50"
                }`}
              >
                {row.kind === "web" ? (
                  <span className="font-medium text-sky-700">
                    🔗 Lien web : {row.label}
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-gray-800">
                      {row.candidate.name}
                    </span>
                    {row.candidate.relpath.includes("/") && (
                      <span className="text-xs text-gray-400">
                        {row.candidate.relpath}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
