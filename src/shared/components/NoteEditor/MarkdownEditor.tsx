import {
  type CmdKey,
  Editor,
  commandsCtx,
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
import {
  commonmark,
  headingKeymap,
  toggleInlineCodeCommand,
  turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { Milkdown, useEditor } from "@milkdown/react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { useAtomValue, useSetAtom } from "jotai";
import { redo, undo } from "prosemirror-history";
import { liftListItem, sinkListItem } from "prosemirror-schema-list";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { NoteFile } from "../../hooks/useFileTree";
import {
  displayModeAtom,
  documentMapAtom,
  scrollToPosAtom,
} from "../../lib/atoms";
import type { DocumentMapState } from "../../lib/documentMapConfig";
import { createLogger } from "../../lib/logger";
import { isAndroid } from "../../lib/platform";
import { createAudioBlockPlugin } from "../../plugins/audio-block/audioBlockPlugin";
import {
  codeBasedShortcutsPlugin,
  customKeymapPlugin,
  toggleBlockquoteCommand,
  toggleBulletListCommand,
  toggleCodeBlockCommand,
  toggleDidascalieInlineCommand,
  toggleHeadingCommand,
  toggleLinkWithPromptCommand,
  toggleOrderedListCommand,
  togglePoetryCommand,
  toggleTaskListCommand,
} from "../../plugins/customKeymap";
import { didascaliePlugin } from "../../plugins/didascalie/didascaliePlugin";
import { createDocumentMapPlugin } from "../../plugins/document-map/documentMapPlugin";
import {
  headingFoldPlugin,
  headingNodeViewPlugin,
} from "../../plugins/heading-fold";
import { poetryBlockPlugin } from "../../plugins/poetry-block/poetryBlockPlugin";
import { taskListPlugin } from "../../plugins/task-list/taskListPlugin";
import { wordHighlightPlugin } from "../../plugins/word-highlight/wordHighlightPlugin";
import { dropHandlerRef } from "./dropListener";
import { useContextMenu } from "./hooks/useContextMenu";
import { useDropHandler } from "./hooks/useDropHandler";

// Raccourci pour appeler une commande milkdown et refocaliser la vue
// biome-ignore lint/suspicious/noExplicitAny: CmdKey est paramétré sur T inconnu à ce site d'appel
function callCmd(editorRef: { current: Editor | null }, key: CmdKey<any>) {
  editorRef.current?.action((ctx) => {
    ctx.get(commandsCtx).call(key);
    ctx.get(editorViewCtx).focus();
  });
}

export interface EditorHandle {
  undo: () => void;
  redo: () => void;
  bold: () => void;
  italic: () => void;
  strike: () => void;
  heading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void;
  paragraph: () => void;
  inlineCode: () => void;
  blockquote: () => void;
  bulletList: () => void;
  orderedList: () => void;
  taskList: () => void;
  indent: () => void;
  dedent: () => void;
  codeBlock: () => void;
  didascalieInline: () => void;
  poetry: () => void;
  insertAudioBlock: (path: string, title: string) => void;
  scrollToPos: (pos: number) => void;
}

const log = createLogger("MarkdownEditor");

// ── NodeView image — convertit les chemins absolus en asset:// à l'affichage ──
// Le chemin absolu est conservé dans le markdown ; seul le rendu DOM change.
// Sur Android, le vaultPath est une URI SAF : on lit les bytes via une commande
// Rust et on génère un blob URL (révoqué quand le NodeView est détruit).
const isAbsolutePath = (s: string) => s.startsWith("/") || /^[A-Z]:\\/i.test(s);

// Résout `rel` (relatif au vault) vers un URI SAF, puis lit les octets via Rust.
async function readVaultBytesAndroid(
  vaultPath: string,
  rel: string
): Promise<Uint8Array> {
  const uri = await invoke<string>("vault_resolve_relative", {
    vaultUri: vaultPath,
    relPath: rel,
  });
  const buf = await invoke<ArrayBuffer>("vault_read_bytes", { uri });
  return new Uint8Array(buf);
}

const imageSrcFixKey = new PluginKey("imageSrcFix");

function makeImageNodeViewBuilder(vaultPath: string) {
  // biome-ignore lint/suspicious/noExplicitAny: NodeViewConstructor ProseMirror
  return function buildImageNodeView(node: any) {
    const img = document.createElement("img");
    img.style.maxWidth = "100%";
    img.style.borderRadius = "6px";
    let currentBlobUrl: string | null = null;

    const applySrc = (src: string) => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }
      if (!src) {
        img.src = "";
        return;
      }
      if (isAndroid && !isAbsolutePath(src)) {
        // Génération async d'un blob URL — pendant ce temps img.src reste vide.
        readVaultBytesAndroid(vaultPath, src)
          .then((bytes) => {
            const url = URL.createObjectURL(new Blob([bytes]));
            currentBlobUrl = url;
            img.src = url;
          })
          .catch((err) =>
            log.error("image Android résolution échec", { src, err })
          );
        return;
      }
      img.src = isAbsolutePath(src) ? convertFileSrc(src) : src;
    };

    applySrc(node.attrs.src ?? "");
    img.alt = node.attrs.alt ?? "";
    if (node.attrs.title) img.title = node.attrs.title;

    return {
      dom: img,
      // biome-ignore lint/suspicious/noExplicitAny: NodeViewConstructor ProseMirror
      update(updated: any) {
        if (updated.type !== node.type) return false;
        applySrc(updated.attrs.src ?? "");
        img.alt = updated.attrs.alt ?? "";
        img.title = updated.attrs.title ?? "";
        return true;
      },
      destroy() {
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
      },
    };
  };
}

function makeImageNodeViewPlugin(vaultPath: string) {
  return $prose(
    () =>
      new Plugin({
        key: imageSrcFixKey,
        props: {
          nodeViews: { image: makeImageNodeViewBuilder(vaultPath) },
        },
      })
  );
}

// ── Composant ──────────────────────────────────────────────────────────────
// Note : le listener drop natif est enregistré par DesktopApp (cf. dropListener.ts).

interface Props {
  node: NoteFile;
  vaultPath: string;
  onChange: (body: string) => void;
}

export const MarkdownEditor = forwardRef<EditorHandle, Props>(
  function MarkdownEditor({ node, vaultPath, onChange }, ref) {
    const editorRef = useRef<Editor | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const displayMode = useAtomValue(displayModeAtom);
    const setDocumentMap = useSetAtom(documentMapAtom);
    const posToScroll = useAtomValue(scrollToPosAtom);
    const setScrollToPos = useSetAtom(scrollToPosAtom);
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
      editorRef.current.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        try {
          const domPos = view.domAtPos(posToScroll + 1);
          const el =
            domPos.node instanceof Element
              ? (domPos.node as Element)
              : (domPos.node as Node).parentElement;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          // pos hors limites
        }
      });
    }, [posToScroll, setScrollToPos]);

    const insertAudioBlock = useCallback(
      (path: string, title: string) => {
        // Normalise en chemin relatif au vault pour la portabilité cross-platform
        const vaultPrefix = vaultPath.endsWith("/")
          ? vaultPath
          : `${vaultPath}/`;
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
      [vaultPath]
    );

    const insertImageBlock = useCallback((srcPath: string, alt: string) => {
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
    }, []);

    useDropHandler({
      wrapperRef,
      vaultPath,
      insertAudioBlock,
      insertImageBlock,
      dropHandlerRef,
    });

    useContextMenu(editorRef, wrapperRef, insertImageBlock, insertAudioBlock);

    useImperativeHandle(ref, () => ({
      undo() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          undo(view.state, view.dispatch);
          view.focus();
        });
      },
      redo() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          redo(view.state, view.dispatch);
          view.focus();
        });
      },
      bold() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const schema = ctx.get(schemaCtx);
          const mark = schema.marks.strong;
          if (!mark) return;
          toggleMark(mark)(view.state, view.dispatch);
          view.focus();
        });
      },
      italic() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const schema = ctx.get(schemaCtx);
          const mark = schema.marks.em;
          if (!mark) return;
          toggleMark(mark)(view.state, view.dispatch);
          view.focus();
        });
      },
      strike() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const schema = ctx.get(schemaCtx);
          const mark =
            schema.marks.strike_through ?? schema.marks.strikethrough;
          if (!mark) return;
          toggleMark(mark)(view.state, view.dispatch);
          view.focus();
        });
      },
      heading(level) {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const schema = ctx.get(schemaCtx);
          const headingType = schema.nodes.heading;
          if (!headingType) return;
          const { state, dispatch } = view;
          const { $from, $to } = state.selection;
          const range = $from.blockRange($to);
          if (!range) return;
          dispatch(
            state.tr.setBlockType(range.start, range.end, headingType, {
              level,
            })
          );
          view.focus();
        });
      },
      insertAudioBlock(absolutePath, title) {
        insertAudioBlock(absolutePath, title);
      },
      paragraph() {
        callCmd(editorRef, turnIntoTextCommand.key);
      },
      inlineCode() {
        callCmd(editorRef, toggleInlineCodeCommand.key);
      },
      blockquote() {
        callCmd(editorRef, toggleBlockquoteCommand.key);
      },
      bulletList() {
        callCmd(editorRef, toggleBulletListCommand.key);
      },
      orderedList() {
        callCmd(editorRef, toggleOrderedListCommand.key);
      },
      taskList() {
        callCmd(editorRef, toggleTaskListCommand.key);
      },
      indent() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const listItem = ctx.get(schemaCtx).nodes.list_item;
          if (listItem) sinkListItem(listItem)(view.state, view.dispatch);
          view.focus();
        });
      },
      dedent() {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const listItem = ctx.get(schemaCtx).nodes.list_item;
          if (listItem) liftListItem(listItem)(view.state, view.dispatch);
          view.focus();
        });
      },
      codeBlock() {
        callCmd(editorRef, toggleCodeBlockCommand.key);
      },
      didascalieInline() {
        callCmd(editorRef, toggleDidascalieInlineCommand.key);
      },
      poetry() {
        callCmd(editorRef, togglePoetryCommand.key);
      },
      scrollToPos(pos) {
        editorRef.current?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          try {
            const domPos = view.domAtPos(pos + 1);
            const el =
              domPos.node instanceof Element
                ? (domPos.node as Element)
                : (domPos.node as Node).parentElement;
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            // pos hors limites, ignoré
          }
        });
      },
    }));

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
            // La commande downgradeHeadingCommand reste active (capturée par $useKeymap) ;
            // seuls les shortcuts sont reconfigurables via ctx.set.
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
              // Conservé comme fallback (contexte sans Tauri FS, ex. dev web pur)
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
        .use(poetryBlockPlugin)
        .use(didascaliePlugin)
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
        .use(customKeymapPlugin)
        .use(codeBasedShortcutsPlugin);

      editorRef.current = editor;
      log.info("Editor initialisé");
      return editor;
    });

    return (
      <div ref={wrapperRef} className={`h-full mode-${displayMode}`}>
        <Milkdown />
      </div>
    );
  }
);
