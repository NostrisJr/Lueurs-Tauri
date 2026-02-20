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
import { saveImageToResources, resolveImagePath } from "../hooks/useImageUpload";
import { FrontmatterEditor } from "./FrontmatterEditor";

function isImageFile(f: File) {
    return f.type.startsWith("image/");
}

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

    const uploadFile = useCallback(
        async (file: File): Promise<string> => {
            const path = await saveImageToResources(vaultPath, file);
            console.log("[upload] chemin sauvegardé:", path);
            return path;
        },
        [vaultPath]
    );

    const handleImageFiles = useCallback(
        async (files: FileList | File[]) => {
            console.log("[handleImageFiles] appelé", files.length);
            const images = Array.from(files).filter(isImageFile);
            if (!images.length || !crepeRef.current) return;

            for (const file of images) {
                try {
                    const absolutePath = await uploadFile(file);
                    const altText = file.name.replace(/\.[^.]+$/, "");

                    crepeRef.current.editor.action((ctx) => {
                        const view = ctx.get(editorViewCtx);
                        const schema = ctx.get(schemaCtx);
                        const { state, dispatch } = view;

                        // image_block est le nœud utilisé par Crepe.Feature.ImageBlock
                        const imageType = schema.nodes["image_block"] ?? schema.nodes["image"];
                        console.log("[insert] type trouvé:", imageType?.name);

                        if (!imageType) return;

                        const imageNode = imageType.create({ src: absolutePath, alt: altText });
                        const tr = state.tr.replaceSelectionWith(imageNode);
                        dispatch(tr.scrollIntoView());
                        view.focus();
                    });
                } catch (err) {
                    console.error("[handleImageFiles] erreur:", err);
                }
            }
        },
        [uploadFile]
    );

    // Drag & drop
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const onDragOver = (e: DragEvent) => {
            if (e.dataTransfer?.types.includes("Files")) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "copy";
            }
        };
        const onDrop = (e: DragEvent) => {
            if (!e.dataTransfer?.files.length) return;
            e.preventDefault();
            e.stopPropagation();
            handleImageFiles(e.dataTransfer.files);
        };
        el.addEventListener("dragover", onDragOver, true);
        el.addEventListener("drop", onDrop, true);
        return () => {
            el.removeEventListener("dragover", onDragOver, true);
            el.removeEventListener("drop", onDrop, true);
        };
    }, [handleImageFiles]);

    // Paste
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const onPaste = (e: ClipboardEvent) => {
            const files = e.clipboardData?.files;
            if (!files?.length || !Array.from(files).some(isImageFile)) return;
            e.preventDefault();
            e.stopPropagation();
            handleImageFiles(files);
        };
        el.addEventListener("paste", onPaste, true);
        return () => el.removeEventListener("paste", onPaste, true);
    }, [handleImageFiles]);

    useEditor((root) => {
        const crepe = new Crepe({
            root,
            defaultValue: node.body,
            features: {
                [Crepe.Feature.CodeMirror]: true,
                [Crepe.Feature.ImageBlock]: true,
            },
            // ✅ La bonne façon de configurer les features dans Crepe
            featureConfigs: {
                [Crepe.Feature.ImageBlock]: {
                    onUpload: async (file: File) => {
                        const path = await uploadFile(file);
                        console.log("[onUpload ImageBlock]:", path);
                        return path;
                    },
                    proxyDomURL: async (url: string) => {
                        console.log("[proxyDomURL]:", url);
                        if (url.startsWith("/") || /^[A-Z]:\\/i.test(url)) {
                            return await resolveImagePath(url);
                        }
                        return url;
                    },
                },
            },
        });

        crepe.on((listener) => {
            listener.markdownUpdated((_, markdown, prevMarkdown) => {
                if (markdown !== prevMarkdown) onChange(markdown);
            });
        });

        crepeRef.current = crepe;
        return crepe;
    });

    return (
        <div ref={wrapperRef} className="h-full">
            <Milkdown />
        </div>
    );
}

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
                    <MilkdownProvider>
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