/**
 * WikilinkSuggest.tsx
 *
 * Popup d'autocomplétion déclenché par `[[`. Lit l'état publié par le plugin
 * suggest-plugin, propose les notes du vault filtrées à la frappe, et insère le
 * nœud `wikilink` (target = chemin relatif au vault, avec extension).
 *
 * Desktop : flèches + Entrée/Tab pour sélectionner, Échap pour fermer.
 * Mobile  : tap sur une ligne.
 */

import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { createLogger } from "../../lib/logger";
import {
  getWikilinkSuggest,
  setWikilinkSuggest,
  subscribeWikilinkSuggest,
} from "../../plugins/wikilink/wikilinkSuggestState";
import {
  type WikilinkCandidate,
  useWikilinkCandidates,
} from "./hooks/useWikilinkCandidates";
import { activeEditorRef } from "./lib/activeEditorRef";
import { clampPopup } from "./lib/popupPosition";

const log = createLogger("WikilinkSuggest");

interface Props {
  vaultPath: string;
}

export function WikilinkSuggest({ vaultPath }: Props) {
  const suggest = useSyncExternalStore(
    subscribeWikilinkSuggest,
    getWikilinkSuggest,
    () => null
  );
  const [index, setIndex] = useState(0);
  const candidates = useWikilinkCandidates(suggest?.query ?? "", vaultPath);

  // Réinitialise la sélection quand la requête change
  // biome-ignore lint/correctness/useExhaustiveDependencies: dépend de la requête
  useEffect(() => {
    setIndex(0);
  }, [suggest?.query]);

  const apply = useCallback((candidate: WikilinkCandidate) => {
    const editor = activeEditorRef.current;
    const state = getWikilinkSuggest();
    if (!editor || !state) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const linkMark = ctx.get(schemaCtx).marks.link;
      if (!linkMark) return;
      // Déclencheur `[alias](…` : on conserve l'alias déjà saisi comme texte.
      const text = state.alias?.trim() || candidate.name;
      const textNode = view.state.schema.text(text, [
        linkMark.create({ href: candidate.relpath, title: "" }),
      ]);
      const tr = view.state.tr.replaceWith(state.from, state.to, textNode);
      // Évite que la frappe suivante reste dans le lien
      tr.removeStoredMark(linkMark);
      view.dispatch(tr);
      view.focus();
    });
    log.info("lien note inséré via autocomplétion", {
      href: candidate.relpath,
    });
    setWikilinkSuggest(null);
  }, []);

  // Navigation clavier (desktop) — capture pour passer avant ProseMirror
  useEffect(() => {
    if (!suggest) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          if (candidates.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          setIndex((i) => (i + 1) % candidates.length);
          break;
        case "ArrowUp":
          if (candidates.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          setIndex((i) => (i - 1 + candidates.length) % candidates.length);
          break;
        case "Enter":
        case "Tab":
          if (candidates.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          apply(candidates[Math.min(index, candidates.length - 1)]);
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setWikilinkSuggest(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [suggest, candidates, index, apply]);

  if (!suggest || candidates.length === 0) return null;

  const safeIndex = Math.min(index, candidates.length - 1);
  const pos = clampPopup(
    suggest.coords,
    288,
    Math.min(candidates.length * 44 + 8, 288)
  );

  return createPortal(
    <div
      className="fixed z-50 max-h-72 w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
      style={{ left: pos.left, top: pos.top }}
    >
      {candidates.map((c, i) => (
        <button
          key={c.id}
          type="button"
          // mousedown : empêche le blur de l'éditeur avant l'insertion
          onMouseDown={(e) => {
            e.preventDefault();
            apply(c);
          }}
          onMouseEnter={() => setIndex(i)}
          className={`flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors ${
            i === safeIndex ? "bg-amber-50" : "hover:bg-gray-50"
          }`}
        >
          <span className="font-medium text-gray-800">{c.name}</span>
          {c.relpath.includes("/") && (
            <span className="text-xs text-gray-400">{c.relpath}</span>
          )}
        </button>
      ))}
    </div>,
    document.body
  );
}
