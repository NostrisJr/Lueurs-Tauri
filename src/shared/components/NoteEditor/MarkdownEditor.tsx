import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
  schemaCtx,
} from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { cursor } from "@milkdown/kit/plugin/cursor";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { commonmark, headingKeymap } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
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
  scrollToPosAtom,
  textJustificationAtom,
} from "../../lib/atoms";
import type { DocumentMapState } from "../../lib/documentMapConfig";
import { createLogger } from "../../lib/logger";
import { isAndroid, isDesktop } from "../../lib/platform";
import { createAudioBlockPlugin } from "../../plugins/audio-block/audioBlockPlugin";
import {
  codeBasedShortcutsPlugin,
  customKeymapPlugin,
  escapeInlineMarksPlugin,
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
import {
  highlightPlugin,
  defaultHighlightColorRef,
} from "../../plugins/highlight/highlightPlugin";
import { createDocumentMapPlugin } from "../../plugins/document-map/documentMapPlugin";
import {
  headingFoldPlugin,
  headingMarkerPlugin,
  headingNodeViewPlugin,
} from "../../plugins/heading-fold";
import { poetryBlockPlugin } from "../../plugins/poetry-block/poetryBlockPlugin";
import { taskListPlugin } from "../../plugins/task-list/taskListPlugin";
import { customCaretPlugin } from "../../plugins/custom-caret/customCaretPlugin";
import { wordHighlightPlugin } from "../../plugins/word-highlight/wordHighlightPlugin";
import { activeEditorRef } from "./lib/activeEditorRef";
import { dropHandlerRef } from "./lib/dropListener";
import { editorScrollToPos } from "./lib/editorCommands";
import { useContextMenu } from "./hooks/useContextMenu";
import { useDropHandler } from "./hooks/useDropHandler";
import {
  makeImageNodeViewPlugin,
  readVaultBytesAndroid,
} from "./lib/imageNodeView";

export type { Editor };

const log = createLogger("MarkdownEditor");

interface Props {
  node: NoteFile;
  vaultPath: string;
  onChange: (body: string) => void;
  /** Ref optionnelle — le parent reçoit l'instance Milkdown Editor en direct. */
  editorRef?: React.MutableRefObject<Editor | null>;
}

export function MarkdownEditor({
  node,
  vaultPath,
  onChange,
  editorRef: externalEditorRef,
}: Props) {
  const internalEditorRef = useRef<Editor | null>(null);
  // Utilise la ref externe si fournie, sinon la ref interne
  const editorRef = externalEditorRef ?? internalEditorRef;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const displayMode = useAtomValue(displayModeAtom);
  const textJustification = useAtomValue(textJustificationAtom);
  const setDocumentMap = useSetAtom(documentMapAtom);
  const posToScroll = useAtomValue(scrollToPosAtom);
  const setScrollToPos = useSetAtom(scrollToPosAtom);
  const defaultHighlightColor = useAtomValue(defaultHighlightColorAtom);

  // Synchronise la ref module-level avec l'atom React pour les commandes ProseMirror
  useEffect(() => {
    defaultHighlightColorRef.current = defaultHighlightColor;
  }, [defaultHighlightColor]);
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
      log.info("insertion image", { srcPath, alt });
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
        const imageNode = imageType.create({ src: srcPath, alt, title: alt });
        const block = paragraph ? paragraph.create(null, imageNode) : imageNode;
        const insertPos = state.selection.$to.after();
        const tr = state.tr.insert(insertPos, block);
        dispatch(tr.scrollIntoView());
        view.focus();
        log.info("image insérée", { insertPos });
      });
    },
    [editorRef]
  );

  useDropHandler({
    wrapperRef,
    vaultPath,
    insertAudioBlock,
    insertImageBlock,
    dropHandlerRef,
  });

  useContextMenu(editorRef, wrapperRef, insertImageBlock, insertAudioBlock);

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
      .use(codeBasedShortcutsPlugin);

    if (isDesktop) editor.use(customCaretPlugin);

    editorRef.current = editor;
    activeEditorRef.current = editor;
    log.info("Editor initialisé");
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
