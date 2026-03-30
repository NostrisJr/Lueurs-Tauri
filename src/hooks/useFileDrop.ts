import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, useSetAtom } from "jotai";
import { activeNoteIdAtom, dragSourceAtom, dragOverAtom, folderPathAtom } from "../lib/atoms";
import { useFileTree } from "../components/FileTree/hooks/useFileTree";
import { usePathPropagation } from "./usePathPropagation";
import { parseFrontmatter, serializeFrontmatter, ensureType } from "../components/FileTree/lib/fileTreeHelpers";
import { resolveDestName } from "../lib/vaultIO";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { createLogger } from "../lib/logger";

const log = createLogger("useFileDrop");

// ── Helpers purs ───────────────────────────────────────────────────────────

function toFolderPath(id: string): string {
    return id.endsWith(".md") ? id.split("/").slice(0, -1).join("/") : id;
}

function isValidMove(sourceId: string, targetFolderPath: string): boolean {
    if (!sourceId || !targetFolderPath) return false;
    if (sourceId === targetFolderPath) return false;
    if (targetFolderPath.startsWith(`${sourceId}/`)) return false;
    if (sourceId.split("/").slice(0, -1).join("/") === targetFolderPath) return false;
    return true;
}

function dropzoneIdFromPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const zone = el?.closest("[data-dropzone]");
    return zone?.getAttribute("data-dropzone") ?? null;
}

// ── État module (singleton) ────────────────────────────────────────────────

let tauriUnlisten: (() => void) | null = null;

// Cache de l'offset titlebar macOS — récupéré une seule fois via Rust.
// wry exprime les coordonnées DragDrop dans le frame fenêtre (title bar incluse),
// pas dans le viewport WebView. Correction : css_y = (raw_y + titlebar) / dpr.
let titlebarCache: { physical: number; dpr: number } | null = null;

async function getTitlebarInfo(): Promise<{ physical: number; dpr: number }> {
    if (titlebarCache) return titlebarCache;
    const [physical, dpr] = await Promise.all([
        invoke<number>("get_titlebar_height"),
        invoke<number>("get_scale_factor"),
    ]);
    titlebarCache = { physical, dpr };
    return titlebarCache;
}

// État du drag interne via pointer events
interface PointerDragState {
    sourceId: string;
    sourceName: string;
    dragging: boolean;
    ghostEl: HTMLDivElement | null;
    currentTargetId: string | null;
    moveHandler: (e: PointerEvent) => void;
    upHandler: (e: PointerEvent) => void;
}

function createGhostEl(name: string, x: number, y: number): HTMLDivElement {
    const ghost = document.createElement("div");
    ghost.style.cssText = `
        position: fixed;
        left: ${x + 14}px;
        top: ${y - 10}px;
        padding: 3px 10px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.18);
        font-size: 13px;
        color: #374151;
        pointer-events: none;
        z-index: 9999;
        opacity: 0.93;
        user-select: none;
        white-space: nowrap;
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    ghost.textContent = name;
    document.body.appendChild(ghost);
    return ghost;
}

// ── Interface ──────────────────────────────────────────────────────────────

export interface FileDrop {
    /** Drag interne — à poser sur chaque nœud draggable */
    onPointerDown: (e: React.PointerEvent, sourceId: string, sourceName: string) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useFileDrop(): FileDrop {
    const store = useStore();
    const setDragSource = useSetAtom(dragSourceAtom);
    const setDragOver = useSetAtom(dragOverAtom);
    const setActiveNoteId = useSetAtom(activeNoteIdAtom);
    const { moveNode, reload } = useFileTree();
    const { propagateNoteRename, propagateFolderRename } = usePathPropagation();

    const moveNodeRef = useRef(moveNode);
    moveNodeRef.current = moveNode;
    const reloadRef = useRef(reload);
    reloadRef.current = reload;
    const propagateNoteRenameRef = useRef(propagateNoteRename);
    propagateNoteRenameRef.current = propagateNoteRename;
    const propagateFolderRenameRef = useRef(propagateFolderRename);
    propagateFolderRenameRef.current = propagateFolderRename;

    // ── Listener Tauri : drop externe uniquement ───────────────────────────
    useEffect(() => {
        tauriUnlisten?.();
        tauriUnlisten = null;
        let cancelled = false;
        let pendingMdPaths: string[] = [];

        import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => {
            getCurrentWebview().onDragDropEvent(async (event) => {
                // biome-ignore lint/suspicious/noExplicitAny: payload Tauri
                const payload = event.payload as any;

                if (payload.type === "enter") {
                    const paths: string[] = (payload.paths as string[] | undefined) ?? [];
                    const mdPaths = paths.filter((p) => p.endsWith(".md"));
                    if (mdPaths.length > 0) {
                        pendingMdPaths = mdPaths;
                        log.info("drop externe .md entré", { count: mdPaths.length });
                    }

                } else if (payload.type === "leave") {
                    pendingMdPaths = [];
                    setDragOver(null);

                } else if (payload.type === "drop" && pendingMdPaths.length > 0) {
                    // Les coordonnées Tauri sont dans le frame fenêtre macOS (title bar incluse).
                    // Correction via l'offset Rust pour obtenir des CSS pixels relatifs au viewport.
                    let targetId: string | null = null;
                    if (payload.position) {
                        const { physical, dpr } = await getTitlebarInfo();
                        const { x: rawX, y: rawY } = payload.position;
                        const cssX = rawX / dpr;
                        const cssY = (rawY + physical) / dpr;
                        if (cssY >= 0) {
                            targetId = dropzoneIdFromPoint(cssX, cssY);
                            if (targetId) log.info("drop position résolue", { targetId });
                        }
                    }
                    targetId ??= store.get(folderPathAtom);
                    setDragOver(null);
                    if (targetId) {
                        log.info("drop externe", { targetId, count: pendingMdPaths.length });
                        await handleExternalDropFromPaths(toFolderPath(targetId), pendingMdPaths);
                    }
                    pendingMdPaths = [];
                }
            }).then((fn) => {
                if (cancelled) {
                    try { fn(); } catch { /* déjà nettoyé */ }
                } else {
                    tauriUnlisten = fn;
                    log.info("listener Tauri enregistré");
                }
            });
        });

        return () => {
            cancelled = true;
            tauriUnlisten?.();
            tauriUnlisten = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Drag interne via Pointer Events ────────────────────────────────────
    // Bypasse le DnD Tauri/HTML5. pointermove est fiable car les pointer events
    // ne sont pas interceptés par le mécanisme OS de DnD.

    function onPointerDown(e: React.PointerEvent, sourceId: string, sourceName: string) {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest("button")) return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        const startX = e.clientX;
        const startY = e.clientY;
        const THRESHOLD = 5;

        const state: PointerDragState = {
            sourceId,
            sourceName,
            dragging: false,
            ghostEl: null,
            currentTargetId: null,
            moveHandler: () => {},
            upHandler: () => {},
        };

        let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

        function cleanup() {
            window.removeEventListener("pointermove", state.moveHandler, true);
            window.removeEventListener("pointerup", state.upHandler, true);
            window.removeEventListener("pointercancel", state.upHandler, true);
            if (keydownHandler) window.removeEventListener("keydown", keydownHandler, true);
            keydownHandler = null;
            state.ghostEl?.remove();
            state.ghostEl = null;
        }

        keydownHandler = (ke: KeyboardEvent) => {
            if (ke.key !== "Escape" || !state.dragging) return;
            ke.preventDefault();
            cleanup();
            setDragSource(null);
            setDragOver(null);
            log.info("pointer drag annulé (Escape)");
        };
        window.addEventListener("keydown", keydownHandler, true);

        state.moveHandler = (me: PointerEvent) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;

            if (!state.dragging) {
                if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;
                state.dragging = true;
                state.ghostEl = createGhostEl(sourceName, me.clientX, me.clientY);
                setDragSource(sourceId);
                log.info("pointer drag start", { sourceId });
            }

            if (state.ghostEl) {
                state.ghostEl.style.left = `${me.clientX + 14}px`;
                state.ghostEl.style.top = `${me.clientY - 10}px`;
            }

            // Le ghost est offset (+14, -10) donc n'interfère pas avec elementFromPoint
            const targetId = dropzoneIdFromPoint(me.clientX, me.clientY);
            if (targetId !== state.currentTargetId) {
                state.currentTargetId = targetId;
                setDragOver(targetId);
                if (targetId) log.info("pointer over", { targetId });
            }
        };

        state.upHandler = (ue: PointerEvent) => {
            const { sourceId: src, dragging, currentTargetId } = state;
            cleanup();

            setDragSource(null);
            setDragOver(null);

            if (dragging && currentTargetId && ue.type === "pointerup") {
                log.info("pointer drop", { sourceId: src, targetId: currentTargetId });
                handleInternalDrop(src, toFolderPath(currentTargetId));
            } else if (dragging) {
                log.info("pointer drag annulé");
            }
        };

        window.addEventListener("pointermove", state.moveHandler, true);
        window.addEventListener("pointerup", state.upHandler, true);
        window.addEventListener("pointercancel", state.upHandler, true);
    }

    // ── Logique métier ─────────────────────────────────────────────────────

    async function handleInternalDrop(sourceId: string, targetFolderPath: string) {
        if (!isValidMove(sourceId, targetFolderPath)) return;

        const isFolder = !sourceId.endsWith(".md");
        const newPath = await moveNodeRef.current(sourceId, targetFolderPath);
        if (!newPath) return;

        if (isFolder) {
            await propagateFolderRenameRef.current(sourceId, newPath);
        } else {
            await propagateNoteRenameRef.current(sourceId, newPath);
        }

        const currentActive = store.get(activeNoteIdAtom);
        if (currentActive) {
            if (!isFolder && currentActive === sourceId) {
                setActiveNoteId(newPath);
            } else if (isFolder && currentActive.startsWith(`${sourceId}/`)) {
                setActiveNoteId(currentActive.replace(sourceId, newPath));
            }
        }

        log.info("déplacement terminé", { sourceId, newPath, isFolder });
    }

    async function handleExternalDropFromPaths(targetFolderPath: string, paths: string[]) {
        const vaultPath = store.get(folderPathAtom);
        if (!vaultPath) return;

        await Promise.all(paths.map(async (srcPath) => {
            try {
                // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
                const content = await readTextFile(srcPath, { baseDir: null } as any);
                const { frontmatter, body } = parseFrontmatter(content);
                const fileName = srcPath.split("/").pop() ?? "note.md";
                const noteName = fileName.replace(/\.md$/, "");
                const parentFolderName = targetFolderPath.split("/").pop() ?? "";
                const safeFrontmatter = ensureType(frontmatter, noteName, parentFolderName);
                const finalContent = serializeFrontmatter(safeFrontmatter, body);
                const destName = await resolveDestName(targetFolderPath, fileName);
                const targetPath = `${targetFolderPath}/${destName}`;
                // biome-ignore lint/suspicious/noExplicitAny: baseDir Tauri
                await writeTextFile(targetPath, finalContent, { baseDir: null } as any);
                log.info("fichier .md copié", { targetPath });
            } catch (err) {
                log.error("échec copie .md externe", { srcPath, err });
            }
        }));

        reloadRef.current();
    }

    return { onPointerDown };
}
