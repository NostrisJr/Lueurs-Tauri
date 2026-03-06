import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "../lib/MilkdownStyle.css";
import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { NoteFile, type Frontmatter } from "../hooks/useFileTree";
import { EditableText } from "./EditableText";
import { useNote } from "../hooks/useNote";
import { useAtomValue } from "jotai";
import { activeNoteAtom, folderPathAtom } from "../lib/atoms";
import { useRef, useCallback, useEffect } from "react";
import { resolveImagePath } from "../hooks/useImageUpload";
import { FrontmatterEditor } from "./FrontmatterEditor";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createAudioBlockPlugin } from "../plugins/audio-block/audioBlockPlugin";
import { createLogger } from "../lib/logger";

const log = createLogger("MilkdownEditor");

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a|flac|aac|opus|weba)$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

function isAudioPath(p: string) { return AUDIO_EXTENSIONS.test(p); }
function isImagePath(p: string) { return IMAGE_EXTENSIONS.test(p); }

// ── Listener drag & drop singleton ────────────────────────────────────────
// Enregistré une seule fois au niveau module, jamais détruit par React.
// Les callbacks sont mis à jour via dropHandlerRef.

type DropHandler = (paths: string[]) => void;
const dropHandlerRef = { current: null as DropHandler | null };

// On initialise le listener une seule fois au chargement du module
getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    if (!dropHandlerRef.current) return;
    log.info("drop natif Tauri reçu", { paths: event.payload.paths });
    dropHandlerRef.current(event.payload.paths);
}).then(() => {
    log.info("listener drop natif singleton enregistré");
}).catch((err) => {
    log.error("échec enregistrement listener drop", err);
});

// ── CrepeEditor ────────────────────────────────────────────────────────────

function CrepeEditor({
    node,
    vaultPath,
    onChange,
}: {
    node: NoteFile;
    vaultPath: string;
    onChange: (body: string) => void;
}) {
    const crepeRef = useRef<Crepe | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // ── Insertion d'un bloc audio ──────────────────────────────────────────
    const insertAudioBlock = useCallback((absolutePath: string, title: string) => {
        log.info("insertion bloc audio", { absolutePath, title });
        if (!crepeRef.current) { log.warn("éditeur non monté"); return; }
        crepeRef.current.editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const schema = ctx.get(schemaCtx);
            const audioType = schema.nodes["audio_block"];
            if (!audioType) { log.warn("nœud audio_block introuvable"); return; }
            const { state, dispatch } = view;
            const insertPos = state.selection.$to.after();
            const tr = state.tr.insert(insertPos, audioType.create({ src: absolutePath, title }));
            dispatch(tr.scrollIntoView());
            view.focus();
            log.info("bloc audio inséré");
        });
    }, []);

    // ── Insertion d'une image ──────────────────────────────────────────────
    const insertImageBlock = useCallback((absolutePath: string, alt: string) => {
        log.info("insertion image", { absolutePath, alt });
        if (!crepeRef.current) { log.warn("éditeur non monté"); return; }
        crepeRef.current.editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const schema = ctx.get(schemaCtx);
            const imageType = schema.nodes["image_block"] ?? schema.nodes["image"];
            if (!imageType) { log.warn("nœud image introuvable"); return; }
            const { state, dispatch } = view;
            const insertPos = state.selection.$to.after();
            const tr = state.tr.insert(insertPos, imageType.create({ src: absolutePath, alt }));
            dispatch(tr.scrollIntoView());
            view.focus();
            log.info("image insérée");

        });
    }, []);

    // ── Connecter ce composant au listener singleton ───────────────────────
    useEffect(() => {
        // Brancher le handler sur le singleton
        dropHandlerRef.current = async (paths: string[]) => {
            for (const srcPath of paths) {
                const filename = srcPath.split(/[/\\]/).pop() ?? "";
                const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
                const title = filename.replace(/\.[^.]+$/, "");

                if (isAudioPath(srcPath)) {
                    log.info("fichier audio détecté", { srcPath });
                    try {
                        const destPath = await invoke<string>("copy_resource_to_vault", {
                            srcPath, vaultPath, subDir: "audio", filename: safeName,
                        });
                        log.info("audio copié", { destPath });
                        insertAudioBlock(destPath, title);
                    } catch (err) {
                        log.error("échec copie audio", err);
                    }
                } else if (isImagePath(srcPath)) {
                    log.info("fichier image détecté", { srcPath });
                    try {
                        const destPath = await invoke<string>("copy_resource_to_vault", {
                            srcPath, vaultPath, subDir: "images", filename: safeName,
                        });
                        log.info("image copiée", { destPath });
                        insertImageBlock(destPath, title);
                    } catch (err) {
                        log.error("échec copie image", err);
                    }
                }
            }
        };

        log.info("handler drop connecté au singleton");
        return () => {
            dropHandlerRef.current = null;
            log.info("handler drop déconnecté");
        };
    }, [vaultPath, insertAudioBlock, insertImageBlock]);

    // ── Paste audio ────────────────────────────────────────────────────────
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;

        const onPaste = async (e: ClipboardEvent) => {
            const files = Array.from(e.clipboardData?.files ?? []);
            const audioFiles = files.filter(f => AUDIO_EXTENSIONS.test(f.name) || f.type.startsWith("audio/"));
            if (!audioFiles.length) return;

            e.preventDefault();
            e.stopPropagation();
            log.info("paste audio détecté", { count: audioFiles.length });

            for (const file of audioFiles) {
                try {
                    const { appDataDir } = await import("@tauri-apps/api/path");
                    const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
                    const appData = await appDataDir();
                    const tmpDir = `${appData}lueurs-tmp`;
                    await mkdir(tmpDir, { recursive: true });
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const tmpPath = `${tmpDir}/${safeName}`;
                    await writeFile(tmpPath, new Uint8Array(await file.arrayBuffer()));

                    const destPath = await invoke<string>("copy_resource_to_vault", {
                        srcPath: tmpPath,
                        vaultPath,
                        subDir: "audio",
                        filename: safeName,
                    });
                    insertAudioBlock(destPath, file.name.replace(/\.[^.]+$/, ""));
                } catch (err) {
                    log.error("échec paste audio", err);
                }
            }
        };

        el.addEventListener("paste", onPaste, true);
        return () => el.removeEventListener("paste", onPaste, true);
    }, [vaultPath, insertAudioBlock]);

    // ── Initialisation Milkdown ────────────────────────────────────────────
    useEditor((root) => {
        log.info("initialisation Crepe", { noteId: node.id, bodyLength: node.body.length });

        const crepe = new Crepe({
            root,
            defaultValue: node.body,
            features: {
                [Crepe.Feature.CodeMirror]: true,
                [Crepe.Feature.ImageBlock]: true,
            },
            featureConfigs: {
                [Crepe.Feature.ImageBlock]: {
                    onUpload: async (file: File) => {
                        log.info("onUpload image", { name: file.name });
                        // Images paste/upload via Crepe : même stratégie tmp → vault
                        try {
                            const { appDataDir } = await import("@tauri-apps/api/path");
                            const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
                            const appData = await appDataDir();
                            const tmpDir = `${appData}lueurs-tmp`;
                            await mkdir(tmpDir, { recursive: true });
                            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                            const tmpPath = `${tmpDir}/${safeName}`;
                            await writeFile(tmpPath, new Uint8Array(await file.arrayBuffer()));

                            const destPath = await invoke<string>("copy_resource_to_vault", {
                                srcPath: tmpPath,
                                vaultPath,
                                subDir: "images",
                                filename: safeName,
                            });
                            log.info("image sauvegardée via onUpload", { destPath });
                            return destPath;
                        } catch (err) {
                            log.error("échec onUpload image", err);
                            throw err;
                        }
                    },
                    proxyDomURL: async (url: string) => {
                        if (url.startsWith("/") || /^[A-Z]:\\/i.test(url)) {
                            return await resolveImagePath(url);
                        }
                        return url;
                    },
                },
            },
        });

        crepe.editor.use(createAudioBlockPlugin({
            resolveAudioPath: async (src: string) => {
                log.info("résolution chemin audio", { src });
                return convertFileSrc(src);
            },
        }));

        crepe.on((listener) => {
            listener.markdownUpdated((_, markdown, prevMarkdown) => {
                if (markdown !== prevMarkdown) {
                    log.info("markdown mis à jour", { length: markdown.length });
                    onChange(markdown);
                }
            });
        });

        crepeRef.current = crepe;
        log.info("Crepe initialisé avec succès");
        return crepe;
    });

    return (
        <div ref={wrapperRef} className="h-full">
            <Milkdown />
        </div>
    );
}

// ── MilkdownEditor ─────────────────────────────────────────────────────────

interface MilkdownEditorProps {
    onChange: (body: string, frontmatter: Frontmatter) => void;
    className?: string;
}

export function MilkdownEditor({ className }: MilkdownEditorProps) {
    const { handleRename, handleChange } = useNote();
    const activeNote = useAtomValue(activeNoteAtom);
    const folderPath = useAtomValue(folderPathAtom);

    function handleBodyChange(newBody: string) {
        if (!activeNote) return;
        handleChange(newBody, activeNote.frontmatter);
    }

    function handleFrontmatterChange(updated: Frontmatter) {
        if (!activeNote) return;
        handleChange(activeNote.body, updated);
    }

    return (
        <div className={className}>
            {activeNote && folderPath && (
                <>
                    <div className="border-gray-100 border-b px-4 py-2 flex justify-start">
                        <EditableText
                            className="text-3xl h-12 font-body border-gray-100 font-title text-left flex items-center w-full"
                            value={activeNote.name}
                            onSave={async (newName) => {
                                await handleRename(activeNote.id, newName, false);
                            }}
                        />
                    </div>
                    <FrontmatterEditor
                        frontmatter={activeNote.frontmatter}
                        onChange={handleFrontmatterChange}
                    />
                    <MilkdownProvider key={activeNote.id}>
                        <CrepeEditor
                            node={activeNote}
                            vaultPath={folderPath}
                            onChange={handleBodyChange}
                        />
                    </MilkdownProvider>
                </>
            )}
        </div>
    );
}