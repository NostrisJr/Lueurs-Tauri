import { useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "../../lib/MilkdownStyle.css";
import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { Milkdown, useEditor } from "@milkdown/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { NoteFile } from "../FileTree/hooks/useFileTree";
import { createAudioBlockPlugin } from "../../plugins/audio-block/audioBlockPlugin";
import { useDropHandler } from "./hooks/useDropHandler";
import { useCrepeConfig } from "./hooks/useCrepeConfig";
import { createLogger } from "../../lib/logger";

export interface CrepeHandle {
  bold: () => void;
  italic: () => void;
  strike: () => void;
  heading: (level: 1 | 2 | 3) => void;
}

const log = createLogger("CrepeEditor");

// ── Listener drop singleton ────────────────────────────────────────────────
// Enregistré une seule fois au niveau module pour éviter les duplicatas React.
// Le handler effectif est mis à jour via dropHandlerRef à chaque montage.
type DropHandler = (paths: string[]) => void;
const dropHandlerRef = { current: null as DropHandler | null };

getCurrentWebview()
  .onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    if (!dropHandlerRef.current) return;
    // Les .md sont gérés par useFileDrop — ne traiter que audio/images
    const paths = (event.payload.paths ?? []).filter((p: string) => !p.endsWith(".md"));
    if (!paths.length) return;
    log.info("drop natif reçu", { paths });
    dropHandlerRef.current(paths);
  })
  .then(() => log.info("listener drop singleton enregistré"))
  .catch((err) => log.error("échec enregistrement listener drop", err));

// ── Composant ──────────────────────────────────────────────────────────────

interface Props {
  node: NoteFile;
  vaultPath: string;
  onChange: (body: string) => void;
}

export const CrepeEditor = forwardRef<CrepeHandle, Props>(function CrepeEditor(
  { node, vaultPath, onChange },
  ref
) {
  const crepeRef = useRef<Crepe | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { featureConfigs } = useCrepeConfig(vaultPath);

  const insertAudioBlock = useCallback(
    (absolutePath: string, title: string) => {
      log.info("insertion bloc audio", { absolutePath, title });
      if (!crepeRef.current) {
        log.warn("éditeur non monté");
        return;
      }
      crepeRef.current.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const audioType = schema.nodes.audio_block;
        if (!audioType) {
          log.warn("nœud audio_block introuvable");
          return;
        }
        const { state, dispatch } = view;
        const tr = state.tr.insert(
          state.selection.$to.after(),
          audioType.create({ src: absolutePath, title })
        );
        dispatch(tr.scrollIntoView());
        view.focus();
        log.info("bloc audio inséré");
      });
    },
    []
  );

  const insertImageBlock = useCallback((absolutePath: string, alt: string) => {
    log.info("insertion image", { absolutePath, alt });
    if (!crepeRef.current) {
      log.warn("éditeur non monté");
      return;
    }
    crepeRef.current.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const schema = ctx.get(schemaCtx);
      const imageType = schema.nodes.image_block ?? schema.nodes.image;
      if (!imageType) {
        log.warn("nœud image introuvable");
        return;
      }
      const { state, dispatch } = view;
      const tr = state.tr.insert(
        state.selection.$to.after(),
        imageType.create({ src: absolutePath, alt })
      );
      dispatch(tr.scrollIntoView());
      view.focus();
      log.info("image insérée");
    });
  }, []);

  useDropHandler({
    wrapperRef,
    vaultPath,
    insertAudioBlock,
    insertImageBlock,
    dropHandlerRef,
  });

  useImperativeHandle(ref, () => ({
    bold() {
      crepeRef.current?.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const mark = schema.marks.strong;
        if (!mark) return;
        toggleMark(mark)(view.state, view.dispatch);
        view.focus();
      });
    },
    italic() {
      crepeRef.current?.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const mark = schema.marks.em;
        if (!mark) return;
        toggleMark(mark)(view.state, view.dispatch);
        view.focus();
      });
    },
    strike() {
      crepeRef.current?.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const mark = schema.marks.strike_through ?? schema.marks.strikethrough;
        if (!mark) return;
        toggleMark(mark)(view.state, view.dispatch);
        view.focus();
      });
    },
    heading(level) {
      crepeRef.current?.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const schema = ctx.get(schemaCtx);
        const headingType = schema.nodes.heading;
        if (!headingType) return;
        const { state, dispatch } = view;
        const { $from, $to } = state.selection;
        const range = $from.blockRange($to);
        if (!range) return;
        dispatch(
          state.tr.setBlockType(range.start, range.end, headingType, { level })
        );
        view.focus();
      });
    },
  }));

  useEditor((root) => {
    log.info("initialisation Crepe", {
      noteId: node.id,
      bodyLength: node.body.length,
    });

    const crepe = new Crepe({
      root,
      defaultValue: node.body,
      features: {
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.BlockEdit]: false,
      },
      featureConfigs,
    });

    crepe.editor.use(
      createAudioBlockPlugin({
        resolveAudioPath: async (src: string) => {
          log.info("résolution chemin audio", { src });
          return convertFileSrc(src);
        },
      })
    );

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) {
          log.info("markdown mis à jour", { length: markdown.length });
          onChange(markdown);
        }
      });
    });

    crepeRef.current = crepe;
    log.info("Crepe initialisé");
    return crepe;
  });

  return (
    <div ref={wrapperRef} className="h-full">
      <Milkdown />
    </div>
  );
});
