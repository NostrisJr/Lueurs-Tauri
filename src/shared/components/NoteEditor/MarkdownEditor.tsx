import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
  schemaCtx,
} from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { cursor } from "@milkdown/kit/plugin/cursor";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { commonmark, headingKeymap } from "@milkdown/kit/preset/commonmark";
import { gfm, remarkGFMPlugin } from "@milkdown/kit/preset/gfm";
import { TextSelection } from "@milkdown/kit/prose/state";
import { Milkdown, useEditor } from "@milkdown/react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { NoteFile } from "../../hooks/useFileTree";
import {
  defaultHighlightColorAtom,
  displayModeAtom,
  documentMapAtom,
  ignoredWordsAtom,
  notesByIdAtom,
  scrollToPosAtom,
  spellcheckEngineAtom,
  textJustificationAtom,
  updateIgnoredWordsAtom,
} from "../../lib/atoms";
import type { DocumentMapState } from "../../lib/documentMapConfig";
import { createLogger } from "../../lib/logger";
import { isNoteReadOnly } from "../../lib/noteTypes";
import { isAndroid, isDesktop, isIOS, isMobile } from "../../lib/platform";
import { createAudioBlockPlugin } from "../../plugins/audio-block/audioBlockPlugin";
import { customCaretPlugin } from "../../plugins/custom-caret/customCaretPlugin";
import {
  codeBasedShortcutsPlugin,
  customKeymapPlugin,
  escapeInlineMarksPlugin,
  stickyInlineBoxPlugin,
  toggleBlockquoteCommand,
  toggleBulletListCommand,
  toggleCodeBlockCommand,
  toggleDidascalieInlineCommand,
  toggleHeadingCommand,
  toggleHighlightInlineCommand,
  toggleLinkWithPromptCommand,
  toggleOrderedListCommand,
  togglePoetryCommand,
  toggleTaskListCommand,
} from "../../plugins/customKeymap";
import { didascaliePlugin } from "../../plugins/didascalie/didascaliePlugin";
import { createDocumentMapPlugin } from "../../plugins/document-map/documentMapPlugin";
import {
  headingFoldPlugin,
  headingMarkerPlugin,
  headingNodeViewPlugin,
} from "../../plugins/heading-fold";
import {
  defaultHighlightColorRef,
  highlightPlugin,
} from "../../plugins/highlight/highlightPlugin";
import {
  inlineFormulaBridge,
  inlineFormulaPlugin,
  refreshInlineFormulas,
} from "../../plugins/inline-formula/inlineFormulaPlugin";
import { mobileListDeletePlugin } from "../../plugins/list-mobile-delete";
import { poetryBlockPlugin } from "../../plugins/poetry-block/poetryBlockPlugin";
import { searchPlugin } from "../../plugins/search/searchPlugin";
import { setNativeTextChecking } from "../../plugins/spellcheck/appleApi";
import { warmUpSpellcheck } from "../../plugins/spellcheck/hugoApi";
import {
  spellcheckKey,
  spellcheckPlugin,
} from "../../plugins/spellcheck/spellcheckPlugin";
import {
  ignoredWordsRef,
  spellcheckEnabledRef,
} from "../../plugins/spellcheck/spellcheckState";
import { taskListPlugin } from "../../plugins/task-list/taskListPlugin";
import {
  refreshNoteLinkDecorations,
  wikilinkBridge,
  wikilinkPlugin,
} from "../../plugins/wikilink/wikilinkPlugin";
import { wordHighlightPlugin } from "../../plugins/word-highlight/wordHighlightPlugin";
import { useContextMenu } from "./hooks/useContextMenu";
import { useDropHandler } from "./hooks/useDropHandler";
import { useMobileLinkLongPress } from "./hooks/useMobileLinkLongPress";
import { useMobileSpellTap } from "./hooks/useMobileSpellTap";
import { activeEditorRef } from "./lib/activeEditorRef";
import { dropHandlerRef } from "./lib/dropListener";
import { editorScrollToPos } from "./lib/editorCommands";
import {
  makeImageNodeViewPlugin,
  readVaultBytesAndroid,
} from "./lib/imageNodeView";

export type { Editor };

const log = createLogger("MarkdownEditor");

// Attributs du DOM éditable pour le correcteur natif (Apple) : utilisés à la
// fois pour la valeur initiale (construction de l'éditeur) et pour la mise à
// jour impérative en cours d'édition (cf. effet plus bas).
function nativeSpellcheckAttrs(useNative: boolean) {
  return {
    spellcheck: useNative ? "true" : "false",
    autocorrect: useNative ? "on" : "off",
    autocapitalize: useNative ? "sentences" : "off",
    // Prédictions inline et Writing Tools (iOS 18 / macOS 15) : pilotées par cet
    // attribut, pas par `autocorrect`.
    writingsuggestions: useNative ? "true" : "false",
  };
}

interface Props {
  node: NoteFile;
  vaultPath: string;
  onChange: (body: string) => void;
  /** Ouvre une note ciblée par un wikilink (newTab = Cmd/Ctrl+clic desktop). */
  onOpenNote?: (noteId: string, newTab: boolean) => void;
  /** Ref optionnelle — le parent reçoit l'instance Milkdown Editor en direct. */
  editorRef?: React.MutableRefObject<Editor | null>;
}

export function MarkdownEditor({
  node,
  vaultPath,
  onChange,
  onOpenNote,
  editorRef: externalEditorRef,
}: Props) {
  const internalEditorRef = useRef<Editor | null>(null);
  // Utilise la ref externe si fournie, sinon la ref interne
  const editorRef = externalEditorRef ?? internalEditorRef;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const displayMode = useAtomValue(displayModeAtom);
  const notesById = useAtomValue(notesByIdAtom);
  const textJustification = useAtomValue(textJustificationAtom);
  const setDocumentMap = useSetAtom(documentMapAtom);
  const posToScroll = useAtomValue(scrollToPosAtom);
  const setScrollToPos = useSetAtom(scrollToPosAtom);
  const defaultHighlightColor = useAtomValue(defaultHighlightColorAtom);
  const spellcheckEngine = useAtomValue(spellcheckEngineAtom);
  const ignoredWords = useAtomValue(ignoredWordsAtom);
  const updateIgnoredWords = useSetAtom(updateIgnoredWordsAtom);

  // Note verrouillée : lu par la fonction `editable` de l'éditeur (fermeture
  // stable, contrairement au frontmatter capturé à la construction).
  const readOnly = isNoteReadOnly(node.frontmatter);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  // Synchronise la ref module-level avec l'atom React pour les commandes ProseMirror
  useEffect(() => {
    defaultHighlightColorRef.current = defaultHighlightColor;
  }, [defaultHighlightColor]);

  // Force ProseMirror à recalculer `editable` (et l'attribut contenteditable
  // du DOM) immédiatement au verrouillage/déverrouillage, sans attendre la
  // prochaine transaction naturelle (frappe, sélection...). `readOnly` n'est
  // lu qu'à travers readOnlyRef (fermeture stable de `editable`) : il ne sert
  // ici qu'à déclencher l'effet.
  // biome-ignore lint/correctness/useExhaustiveDependencies: readOnly déclenche l'effet, lu via readOnlyRef
  useEffect(() => {
    editorRef.current?.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr);
      } catch {
        /* editorViewCtx pas encore injecté */
      }
    });
  }, [readOnly, editorRef]);

  // Pont de résolution/navigation des liens entre notes (lu hors React par le
  // plugin note-link). href = chemin relatif vault avec extension → id (absolu).
  useEffect(() => {
    const prefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
    const resolve = (href: string) => {
      const direct = `${prefix}${href}`;
      if (notesById.has(direct)) return direct;
      // Tolère un href encodé (espaces en %20, etc.)
      try {
        const decoded = `${prefix}${decodeURIComponent(href)}`;
        if (notesById.has(decoded)) return decoded;
      } catch {
        // href mal formé → ignore
      }
      return null;
    };
    wikilinkBridge.current = {
      resolve,
      open: (noteId, newTab) => onOpenNote?.(noteId, newTab),
    };
    // L'arbre a changé → recalcule le statut cassé/valide des liens affichés.
    // try/catch : ctx.get(editorViewCtx) lève si Milkdown n'est pas encore initialisé.
    editorRef.current?.action((ctx) => {
      try {
        refreshNoteLinkDecorations(ctx.get(editorViewCtx));
      } catch {
        /* editorViewCtx pas encore injecté */
      }
    });
    return () => {
      wikilinkBridge.current = null;
    };
  }, [vaultPath, notesById, onOpenNote, editorRef]);

  // Contexte d'évaluation des formules inline (lu hors React par la NodeView et
  // le popup) : self.* = frontmatter de la note courante, ref() résolu via l'arbre.
  useEffect(() => {
    const rawChildren = node.frontmatter.__Children__;
    const childPaths: string[] = Array.isArray(rawChildren)
      ? (rawChildren as string[])
      : typeof rawChildren === "string" && rawChildren
        ? [rawChildren]
        : [];
    const children = childPaths
      .map((p) => notesById.get(p))
      .filter((n): n is NoteFile => n !== undefined);
    // ref("chemin") du corps : relatif à la racine du vault (convention du
    // corps de note, comme les liens et les médias — cf. refPaths.ts).
    // L'absolu reste toléré : notes écrites avant le passage au relatif,
    // migrées à leur prochaine sérialisation.
    const prefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
    const resolveRef = (path: string) =>
      notesById.get(`${prefix}${path}`) ?? notesById.get(path);
    inlineFormulaBridge.current = {
      vars: node.frontmatter as Record<string, unknown>,
      children: children.length > 0 ? children : undefined,
      noteResolver: resolveRef,
      allNotes: [...notesById.values()],
      vaultPath,
    };
    // L'arbre/le frontmatter a changé → recalcule les résultats affichés
    refreshInlineFormulas();
    return () => {
      inlineFormulaBridge.current = null;
    };
  }, [node.frontmatter, notesById, vaultPath]);

  // Correcteur Hugo : synchronise l'état activé (actif uniquement pour ce
  // moteur). Le scan initial est piloté par l'init du plugin ; ici on ne
  // réagit qu'aux changements de réglage en cours d'édition (réactivation →
  // tout re-vérifier ; désactivation → nettoyer).
  const hugoEnabled = spellcheckEngine === "hugo";
  const spellcheckMounted = useRef(false);
  useEffect(() => {
    spellcheckEnabledRef.current = hugoEnabled;
    if (hugoEnabled) warmUpSpellcheck();
    if (!spellcheckMounted.current) {
      spellcheckMounted.current = true;
      return;
    }
    editorRef.current?.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx);
        view.dispatch(
          view.state.tr.setMeta(
            spellcheckKey,
            hugoEnabled ? { dirtyAll: true } : { clear: true }
          )
        );
      } catch {
        /* editorViewCtx pas encore injecté */
      }
    });
  }, [hugoEnabled, editorRef]);

  // Correcteur natif (Apple) : le DOM éditable est créé une seule fois, donc
  // on met à jour ses attributs impérativement pour refléter un changement de
  // moteur en cours d'édition sans avoir à remonter l'éditeur.
  const nativeMounted = useRef(false);
  useEffect(() => {
    const useNative = spellcheckEngine === "apple";
    const attrs = nativeSpellcheckAttrs(useNative);
    const firstRun = !nativeMounted.current;
    nativeMounted.current = true;

    editorRef.current?.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx);
        for (const [attr, value] of Object.entries(attrs)) {
          view.dom.setAttribute(attr, value);
        }
        // iOS fige les traits du clavier (correction, capitalisation) au moment
        // du focus : sans blur/refocus, un changement de réglage ne prendrait
        // qu'au prochain focus manuel. Ciblé sur ce seul cas — un refocus
        // générique casse le swipe-back.
        if (isIOS && !firstRun && view.hasFocus()) {
          const { from, to } = view.state.selection;
          view.dom.blur();
          requestAnimationFrame(() => {
            view.focus();
            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.create(view.state.doc, from, to)
              )
            );
          });
        }
      } catch {
        /* editorViewCtx pas encore injecté */
      }
    });

    // macOS : les attributs HTML ne pilotent pas la correction à la frappe,
    // WebKit lit son état de text-checking dans les NSUserDefaults du process.
    setNativeTextChecking(useNative);
  }, [spellcheckEngine, editorRef]);

  // Synchronise les mots ignorés vers la ref module-level lue par le plugin.
  // Première exécution : alimente la ref avant le scan initial (sans re-scan).
  // Changements ultérieurs (ajout/retrait) : tout re-vérifier.
  const ignoredKey = ignoredWords.join(" ");
  const ignoredMounted = useRef(false);
  useEffect(() => {
    ignoredWordsRef.current = new Set(
      ignoredKey ? ignoredKey.split(" ").map((w) => w.toLowerCase()) : []
    );
    if (!ignoredMounted.current) {
      ignoredMounted.current = true;
      return;
    }
    editorRef.current?.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.setMeta(spellcheckKey, { dirtyAll: true }));
      } catch {
        /* editorViewCtx pas encore injecté */
      }
    });
  }, [ignoredKey, editorRef]);

  const handleIgnoreWord = useCallback(
    (word: string) => {
      const w = word.trim().toLowerCase();
      if (!w) return;
      updateIgnoredWords((prev) =>
        prev.some((x) => x.toLowerCase() === w) ? prev : [...prev, word.trim()]
      );
      log.info("mot ignoré ajouté", { word: w });
    },
    [updateIgnoredWords]
  );

  // Refs pour éviter les fermetures périmées dans les listeners Milkdown (capturés une seule fois)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const documentMapCallbackRef = useRef<
    ((map: DocumentMapState) => void) | null
  >(null);
  documentMapCallbackRef.current = setDocumentMap;

  // Scroll déclenché depuis le navigateur via scrollToPosAtom
  useEffect(() => {
    if (posToScroll === null || !editorRef.current) return;
    setScrollToPos(null);
    editorScrollToPos(editorRef, posToScroll);
  }, [posToScroll, setScrollToPos, editorRef]);

  const insertAudioBlock = useCallback(
    (path: string, title: string) => {
      const vaultPrefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
      const relativePath = path.startsWith(vaultPrefix)
        ? path.slice(vaultPrefix.length)
        : path;
      log.info("insertion bloc audio", { relativePath, title });
      if (!editorRef.current) {
        log.warn("éditeur non monté");
        return;
      }
      editorRef.current.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const audioType = schema.nodes.audio_block;
        if (!audioType) {
          log.warn("nœud audio_block introuvable");
          return;
        }
        const { state, dispatch } = view;
        const insertPos = state.selection.$to.after();
        const tr = state.tr.insert(
          insertPos,
          audioType.create({ src: relativePath, title })
        );
        dispatch(tr.scrollIntoView());
        view.focus();
        log.info("bloc audio inséré", { insertPos });
      });
    },
    [vaultPath, editorRef]
  );

  const insertImageBlock = useCallback(
    (srcPath: string, alt: string) => {
      const vaultPrefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
      const relativePath = srcPath.startsWith(vaultPrefix)
        ? srcPath.slice(vaultPrefix.length)
        : srcPath;
      log.info("insertion image", { relativePath, alt });
      if (!editorRef.current) {
        log.warn("éditeur non monté");
        return;
      }
      editorRef.current.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const imageType = schema.nodes.image;
        if (!imageType) {
          log.warn("nœud image introuvable dans le schéma");
          return;
        }
        const { state, dispatch } = view;
        const paragraph = schema.nodes.paragraph;
        const imageNode = imageType.create({
          src: relativePath,
          alt,
          title: alt,
        });
        const block = paragraph ? paragraph.create(null, imageNode) : imageNode;
        const insertPos = state.selection.$to.after();
        const tr = state.tr.insert(insertPos, block);
        dispatch(tr.scrollIntoView());
        view.focus();
        log.info("image insérée", { insertPos });
      });
    },
    [vaultPath, editorRef]
  );

  useDropHandler({
    wrapperRef,
    vaultPath,
    insertAudioBlock,
    insertImageBlock,
    dropHandlerRef,
  });

  useContextMenu(
    editorRef,
    wrapperRef,
    insertImageBlock,
    insertAudioBlock,
    vaultPath,
    handleIgnoreWord
  );

  useMobileSpellTap(editorRef, wrapperRef);
  useMobileLinkLongPress(editorRef, wrapperRef);

  useEditor((root) => {
    log.info("initialisation Editor", {
      noteId: node.id,
      bodyLength: node.body.length,
    });

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, node.body);
      })
      .config((ctx) => {
        // Valeur initiale des attributs selon le moteur choisi (mise à jour
        // ensuite impérativement si le réglage change, cf. effet plus bas :
        // le DOM éditable n'est créé qu'une seule fois ici).
        ctx.set(editorViewOptionsCtx, {
          attributes: nativeSpellcheckAttrs(spellcheckEngine === "apple"),
          editable: () => !readOnlyRef.current,
        });
      })
      .config((ctx) => {
        // Tilde SIMPLE non interprété comme barré (seul `~~texte~~` l'est).
        // Sinon un chemin de conteneur iCloud (`iCloud~com~lueurs~app`) écrit
        // dans le corps est découpé en nœuds `delete`, ce qui fragmente le
        // nœud texte et empêche le scan `$$…$$` des formules inline.
        ctx.set(remarkGFMPlugin.options.key, { singleTilde: false });
      })
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            log.info("markdown mis à jour", { length: markdown.length });
            onChangeRef.current(markdown);
          }
        });
      })
      .config((ctx) => {
        // Désactive les shortcuts Mod-Alt-1..6 du preset pour laisser la priorité
        // à notre toggleHeadingCommand (qui gère aussi les transitions cross-structure).
        // DowngradeHeading (Delete/Backspace) est conservé.
        ctx.set(headingKeymap.key, {
          TurnIntoH1: { shortcuts: "" },
          TurnIntoH2: { shortcuts: "" },
          TurnIntoH3: { shortcuts: "" },
          TurnIntoH4: { shortcuts: "" },
          TurnIntoH5: { shortcuts: "" },
          TurnIntoH6: { shortcuts: "" },
          DowngradeHeading: { shortcuts: ["Delete", "Backspace"] },
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .use(trailing)
      .use(clipboard)
      .use(cursor)
      .use(
        createAudioBlockPlugin({
          readAudioData: async (src: string) => {
            const isAbsolute =
              src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src);
            if (isAndroid && !isAbsolute) {
              log.info("lecture audio (Android SAF)", { src });
              return readVaultBytesAndroid(vaultPath, src);
            }
            const absolutePath = isAbsolute ? src : `${vaultPath}/${src}`;
            log.info("lecture fichier audio", { src, absolutePath });
            // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
            return readFile(absolutePath, { baseDir: null } as any);
          },
          resolveAudioPath: async (src: string) => {
            const isAbsolute =
              src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src);
            if (isAndroid && !isAbsolute) {
              return invoke<string>("vault_resolve_relative", {
                vaultUri: vaultPath,
                relPath: src,
              });
            }
            const absolutePath = isAbsolute ? src : `${vaultPath}/${src}`;
            return convertFileSrc(absolutePath);
          },
          resolveAbsolutePath: async (src: string) => {
            const isAbsolute =
              src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(src);
            if (isAndroid && !isAbsolute) {
              return invoke<string>("vault_resolve_relative", {
                vaultUri: vaultPath,
                relPath: src,
              });
            }
            return isAbsolute ? src : `${vaultPath}/${src}`;
          },
        })
      )
      .use(makeImageNodeViewPlugin(vaultPath))
      .use(taskListPlugin)
      .use(headingFoldPlugin)
      .use(headingNodeViewPlugin)
      .use(headingMarkerPlugin)
      .use(poetryBlockPlugin)
      .use(didascaliePlugin)
      .use(highlightPlugin)
      .use(wordHighlightPlugin)
      .use(wikilinkPlugin)
      .use(inlineFormulaPlugin)
      .use(spellcheckPlugin)
      .use(searchPlugin)
      .use(createDocumentMapPlugin(documentMapCallbackRef))
      .use(toggleBlockquoteCommand)
      .use(toggleBulletListCommand)
      .use(toggleOrderedListCommand)
      .use(toggleTaskListCommand)
      .use(toggleHeadingCommand)
      .use(toggleCodeBlockCommand)
      .use(toggleLinkWithPromptCommand)
      .use(togglePoetryCommand)
      .use(toggleDidascalieInlineCommand)
      .use(toggleHighlightInlineCommand)
      .use(customKeymapPlugin)
      .use(escapeInlineMarksPlugin)
      .use(stickyInlineBoxPlugin)
      .use(codeBasedShortcutsPlugin);

    if (isDesktop) editor.use(customCaretPlugin);
    if (isMobile) editor.use(mobileListDeletePlugin);

    editorRef.current = editor;
    activeEditorRef.current = editor;
    return editor;
  });

  // Libère la ref module-level au démontage (changement de note / fermeture)
  useEffect(() => {
    return () => {
      if (activeEditorRef.current === editorRef.current) {
        activeEditorRef.current = null;
      }
    };
  }, [editorRef]);

  const justifyClass =
    displayMode === "livre" && textJustification ? "text-justified" : "";

  return (
    <div
      ref={wrapperRef}
      className={`h-full mode-${displayMode} ${justifyClass}`}
    >
      <Milkdown />
    </div>
  );
}
