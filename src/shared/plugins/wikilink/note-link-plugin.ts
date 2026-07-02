/**
 * note-link-plugin.ts
 *
 * Liens entre notes = liens markdown standard `[texte](chemin.md)` (mark `link`),
 * href = chemin relatif au vault avec extension. Pas de nœud custom.
 *   - clic : note → navigation (Cmd/Ctrl+clic = nouvel onglet) ; URL → ouverture externe.
 *   - décorations : classe `note-link` (et `note-link-broken` si cible introuvable).
 * Les liens web (http/mailto) gardent le style `a` par défaut.
 */

import type { EditorState } from "@milkdown/kit/prose/state";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import { createLogger } from "../../lib/logger";
import { wikilinkBridge } from "./wikilinkBridge";

const log = createLogger("note-link");

// Meta pour forcer le recalcul des décorations (ex: l'arbre de notes a changé,
// donc le statut cassé/valide peut avoir évolué sans transaction sur le doc).
const REBUILD_META = "note-link-rebuild";

/** Force le recalcul des décorations note-link (statut cassé/valide). */
export function refreshNoteLinkDecorations(view: EditorView | undefined) {
  if (!view) return;
  view.dispatch(view.state.tr.setMeta(REBUILD_META, true));
}

const URL_RE = /^(https?:\/\/|mailto:|www\.)/i;

export function isExternalHref(href: string): boolean {
  return URL_RE.test(href.trim());
}

function normalizeUrl(href: string): string {
  const h = href.trim();
  return h.startsWith("www.") ? `https://${h}` : h;
}

/** Plage du lien (mark `link`) autour de `pos`, ou null. */
export function linkRangeAt(
  state: EditorState,
  pos: number
): { from: number; to: number; href: string; text: string } | null {
  const linkMark = state.schema.marks.link;
  if (!linkMark) return null;
  const $pos = state.doc.resolve(pos);
  const find = (marks: readonly { type: unknown }[]) =>
    marks.find((m) => m.type === linkMark) as
      | ReturnType<typeof linkMark.create>
      | undefined;
  const mark = find($pos.marks()) ?? find($pos.nodeBefore?.marks ?? []);
  if (!mark) return null;

  let from = pos;
  let to = pos;
  for (;;) {
    const before = state.doc.resolve(from).nodeBefore;
    if (before && mark.isInSet(before.marks)) from -= before.nodeSize;
    else break;
  }
  for (;;) {
    const after = state.doc.resolve(to).nodeAfter;
    if (after && mark.isInSet(after.marks)) to += after.nodeSize;
    else break;
  }
  return {
    from,
    to,
    href: mark.attrs.href as string,
    text: state.doc.textBetween(from, to),
  };
}

function buildDecorations(state: EditorState): DecorationSet {
  const linkMark = state.schema.marks.link;
  if (!linkMark) return DecorationSet.empty;
  const decos: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type === linkMark);
    if (!mark) return;
    const href = mark.attrs.href as string;
    if (!href || isExternalHref(href)) return; // lien web → style par défaut
    const broken = !wikilinkBridge.current?.resolve(href);
    decos.push(
      Decoration.inline(pos, pos + node.nodeSize, {
        class: broken ? "note-link note-link-broken" : "note-link",
      })
    );
  });
  return DecorationSet.create(state.doc, decos);
}

const noteLinkKey = new PluginKey<DecorationSet>("note-link");

export const noteLinkPlugin = $prose(
  () =>
    new Plugin<DecorationSet>({
      key: noteLinkKey,
      state: {
        init: (_config, state) => buildDecorations(state),
        apply: (tr, value, _old, newState) =>
          tr.docChanged || tr.getMeta(REBUILD_META)
            ? buildDecorations(newState)
            : value,
      },
      props: {
        decorations(state) {
          return noteLinkKey.getState(state);
        },
        handleClick(_view, _pos, event) {
          const anchor = (event.target as HTMLElement).closest("a");
          if (!anchor) return false;
          const href = anchor.getAttribute("href");
          if (!href) return false;
          if (isExternalHref(href)) {
            openUrl(normalizeUrl(href)).catch((e) =>
              log.error("ouverture URL échouée", e)
            );
            return true;
          }
          const id = wikilinkBridge.current?.resolve(href);
          if (!id) return false; // lien cassé → laisse placer le curseur (édition)
          const newTab = event.metaKey || event.ctrlKey;
          log.info("ouverture lien note", { href, newTab });
          wikilinkBridge.current?.open(id, newTab);
          return true;
        },
      },
    })
);
