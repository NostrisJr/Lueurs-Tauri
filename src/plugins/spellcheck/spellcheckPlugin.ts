import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { invoke } from "@tauri-apps/api/core";
import { extractText, offsetToPmPos } from "./textExtractor";
import type { SpellError } from "../../types/spellcheck";
import { createLogger } from "../../lib/logger";

const log = createLogger("spellcheckPlugin");

export const spellcheckKey = new PluginKey<DecorationSet>("spellcheck");

// Accessible depuis useContextMenu pour afficher les suggestions au clic droit
export const suggestionCache = new Map<number, SpellError>();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const spellcheckProsemirrorPlugin = new Plugin<DecorationSet>({
  key: spellcheckKey,

  state: {
    init: () => DecorationSet.empty,
    apply(tr, decos, _old, newState) {
      const meta = tr.getMeta(spellcheckKey);
      if (meta) return DecorationSet.create(newState.doc, meta);
      if (!tr.docChanged) return decos.map(tr.mapping, tr.doc);
      return decos.map(tr.mapping, tr.doc);
    },
  },

  props: {
    decorations: (state) => spellcheckKey.getState(state),
  },

  view(editorView) {
    const runCheck = async () => {
      const { plainText, segments } = extractText(editorView.state.doc);
      if (!plainText.trim()) return;

      let errors: SpellError[];
      try {
        errors = await invoke<SpellError[]>("check_grammar", { text: plainText });
      } catch (e) {
        log.error("Grammalecte invoke échoué", e);
        return;
      }

      log.info("résultats Grammalecte", { count: errors.length });

      suggestionCache.clear();
      const decos: Decoration[] = [];

      for (const err of errors) {
        const from = offsetToPmPos(err.from, segments);
        const to = offsetToPmPos(err.to, segments);
        if (from >= to || from < 0) continue;

        suggestionCache.set(from, { ...err, from, to });
        decos.push(
          Decoration.inline(from, to, {
            class: err.is_spelling ? "spell-error" : "grammar-error",
            "data-from": String(from),
          })
        );
      }

      if (!editorView.isDestroyed) {
        const tr = editorView.state.tr.setMeta(spellcheckKey, decos);
        editorView.dispatch(tr);
      }
    };

    const scheduleCheck = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runCheck, 600);
    };

    scheduleCheck();

    return {
      update(_view, prevState) {
        if (!_view.state.doc.eq(prevState.doc)) scheduleCheck();
      },
      destroy() {
        if (debounceTimer) clearTimeout(debounceTimer);
        suggestionCache.clear();
      },
    };
  },
});

export const spellcheckPlugin = $prose(() => spellcheckProsemirrorPlugin);
