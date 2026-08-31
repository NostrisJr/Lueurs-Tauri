import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useRef } from "react";
import { useFileTree } from "../../shared/hooks/useFileTree";
import { usePathPropagation } from "../../shared/hooks/usePathPropagation";
import {
  activeNoteIdAtom,
  activeSpaceAtom,
  dragOverAtom,
  dragSourceAtom,
  folderPathAtom,
  selectedIdsAtom,
  toastAtom,
} from "../../shared/lib/atoms";
import {
  BASE_NULL,
  importFolderRecursive,
  importMdFile,
  importMediaFile,
} from "../../shared/lib/importUtils";
import { createLogger } from "../../shared/lib/logger";
import { getMediaType } from "../../shared/lib/vaultIO";

const log = createLogger("useFileDrop");

// ── Types ─────────────────────────────────────────────────────────────────

interface WebviewDragDropPayload {
  type: "enter" | "over" | "leave" | "drop";
  paths?: string[];
  position?: { x: number; y: number };
}

// ── Helpers purs ───────────────────────────────────────────────────────────

function toFolderPath(id: string): string {
  return id.endsWith(".md") ? id.split("/").slice(0, -1).join("/") : id;
}

function isValidMove(sourceId: string, targetFolderPath: string): boolean {
  if (!sourceId || !targetFolderPath) return false;
  if (sourceId === targetFolderPath) return false;
  if (targetFolderPath.startsWith(`${sourceId}/`)) return false;
  if (sourceId.split("/").slice(0, -1).join("/") === targetFolderPath)
    return false;
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

// Surveille les changements de DPR (passage entre écrans Retina / non-Retina).
// matchMedia + re-enregistrement récursif : chaque requête ne fire qu'une fois.
let dprCleanup: (() => void) | null = null;
function trackDprChanges(): void {
  dprCleanup?.();
  const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const handler = () => {
    titlebarCache = null;
    log.info("DPR changé — cache titlebar invalidé");
    trackDprChanges();
  };
  mql.addEventListener("change", handler);
  dprCleanup = () => mql.removeEventListener("change", handler);
}

// Convertit les coordonnées brutes wry en CSS px relatifs au viewport.
// titleBarStyle "Overlay" (physical=0) : wry donne des pixels logiques directement.
// Titlebar native (physical>0) : wry donne des pixels physiques depuis le frame fenêtre,
// avec un bug d'offset titlebar → correction (rawY + physical) / dpr.
function toViewportCoords(
  rawX: number,
  rawY: number,
  physical: number,
  dpr: number
) {
  if (physical === 0) {
    return { cssX: rawX, cssY: rawY };
  }
  return { cssX: rawX / dpr, cssY: (rawY + physical) / dpr };
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
  onPointerDown: (
    e: React.PointerEvent,
    sourceId: string,
    sourceName: string
  ) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useFileDrop(): FileDrop {
  const store = useStore();
  const setDragSource = useSetAtom(dragSourceAtom);
  const setDragOver = useSetAtom(dragOverAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);
  const selectedIds = useAtomValue(selectedIdsAtom);
  const { moveNode, reload } = useFileTree();
  const { propagateNoteRename, propagateFolderRename } = usePathPropagation();

  // Refs miroirs — un seul objet pour éviter les fermetures périmées dans les callbacks singleton
  const cbRef = useRef({
    moveNode,
    reload,
    propagateNoteRename,
    propagateFolderRename,
    selectedIds,
  });
  cbRef.current = {
    moveNode,
    reload,
    propagateNoteRename,
    propagateFolderRename,
    selectedIds,
  };

  // ── Listener Tauri : drop externe uniquement ───────────────────────────
  useEffect(() => {
    trackDprChanges();
    tauriUnlisten?.();
    tauriUnlisten = null;
    let cancelled = false;
    // Tous les paths droppés (notes .md, médias, dossiers)
    let pendingPaths: string[] = [];
    // Dernière cible vue en "over" — utilisée en fallback si le drop arrive hors viewport
    let lastOverTargetId: string | null = null;

    import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => {
      getCurrentWebview()
        .onDragDropEvent(async (event) => {
          const payload = event.payload as WebviewDragDropPayload;

          if (payload.type === "enter") {
            const paths: string[] = payload.paths ?? [];
            if (paths.length > 0) {
              pendingPaths = paths;
              lastOverTargetId = null;
              log.info("drop externe entré", { count: paths.length });
            }
          } else if (payload.type === "over" && pendingPaths.length > 0) {
            // "over" fire de manière fiable pour les drags Finder (pas pour les drags internes).
            if (payload.position) {
              const { physical, dpr } = await getTitlebarInfo();
              const { x: rawX, y: rawY } = payload.position;
              const { cssX, cssY } = toViewportCoords(
                rawX,
                rawY,
                physical,
                dpr
              );
              if (cssY >= 0) {
                const targetId = dropzoneIdFromPoint(cssX, cssY);
                lastOverTargetId = targetId;
                setDragOver(targetId);
              }
            }
          } else if (payload.type === "leave") {
            pendingPaths = [];
            lastOverTargetId = null;
            setDragOver(null);
          } else if (payload.type === "drop" && pendingPaths.length > 0) {
            // Les coordonnées Tauri sont dans le frame fenêtre macOS.
            // Correction selon le mode titlebar via toViewportCoords.
            // Si le drop arrive hors viewport (cssY < 0), on utilise la dernière cible vue en "over".
            let targetId: string | null = null;
            if (payload.position) {
              const { physical, dpr } = await getTitlebarInfo();
              const { x: rawX, y: rawY } = payload.position;
              const { cssX, cssY } = toViewportCoords(
                rawX,
                rawY,
                physical,
                dpr
              );
              if (cssY >= 0) {
                targetId = dropzoneIdFromPoint(cssX, cssY);
              }
            }
            targetId ??= lastOverTargetId;
            // Pas de dropzone sous le curseur (ex: drop sur l'éditeur) : les
            // médias sont déjà gérés par dropListener/useDropHandler — on ne
            // traite ici que les notes/dossiers, que ce dernier ignore.
            const skipMedia = !targetId;
            targetId ??= store.get(folderPathAtom);
            if (targetId)
              log.info("drop position résolue", { targetId, skipMedia });
            setDragOver(null);
            if (targetId) {
              log.info("drop externe", {
                targetId,
                count: pendingPaths.length,
                skipMedia,
              });
              await handleExternalDropFromPaths(
                toFolderPath(targetId),
                pendingPaths,
                skipMedia
              );
            }
            pendingPaths = [];
          }
        })
        .then((fn) => {
          if (cancelled) {
            try {
              fn();
            } catch {
              /* déjà nettoyé */
            }
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
      dprCleanup?.();
      dprCleanup = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag interne via Pointer Events ────────────────────────────────────
  // Bypasse le DnD Tauri/HTML5. pointermove est fiable car les pointer events
  // ne sont pas interceptés par le mécanisme OS de DnD.

  function onPointerDown(
    e: React.PointerEvent,
    sourceId: string,
    sourceName: string
  ) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    // Si la source est dans la sélection multi, on drag tous les items sélectionnés
    const currentSelection = cbRef.current.selectedIds;
    const isMultiDrag =
      currentSelection.size > 0 && currentSelection.has(sourceId);
    const dragIds = isMultiDrag ? [...currentSelection] : [sourceId];
    const ghostLabel =
      dragIds.length > 1 ? `${dragIds.length} éléments` : sourceName;

    const startX = e.clientX;
    const startY = e.clientY;
    const THRESHOLD = 5;

    const state: PointerDragState = {
      sourceId,
      sourceName: ghostLabel,
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
      if (keydownHandler)
        window.removeEventListener("keydown", keydownHandler, true);
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
      const { dragging, currentTargetId } = state;
      cleanup();

      setDragSource(null);
      setDragOver(null);

      if (dragging && currentTargetId && ue.type === "pointerup") {
        log.info("pointer drop", { dragIds, targetId: currentTargetId });
        handleInternalDrop(dragIds, toFolderPath(currentTargetId));
      } else if (dragging) {
        log.info("pointer drag annulé");
      }
    };

    window.addEventListener("pointermove", state.moveHandler, true);
    window.addEventListener("pointerup", state.upHandler, true);
    window.addEventListener("pointercancel", state.upHandler, true);
  }

  // ── Logique métier ─────────────────────────────────────────────────────

  async function handleInternalDrop(
    sourceIds: string[],
    targetFolderPath: string
  ) {
    const currentActive = store.get(activeNoteIdAtom);

    // Déplacements séquentiels pour éviter les conflits sur l'arbre
    for (const sourceId of sourceIds) {
      if (!isValidMove(sourceId, targetFolderPath)) continue;

      const sourceName = sourceId.split("/").pop() ?? "";
      const fileExt = /\.[^/]+$/.test(sourceName);
      const isNote = sourceName.endsWith(".md");
      const isFolder = !fileExt;

      const newPath = await cbRef.current.moveNode(sourceId, targetFolderPath);
      if (!newPath) continue;

      if (isFolder) {
        await cbRef.current.propagateFolderRename(sourceId, newPath);
      } else if (isNote) {
        await cbRef.current.propagateNoteRename(sourceId, newPath);
      }
      // Les médias n'ont pas de références frontmatter à propager

      if (currentActive) {
        if (!isFolder && currentActive === sourceId) {
          setActiveNoteId(newPath);
        } else if (isFolder && currentActive.startsWith(`${sourceId}/`)) {
          setActiveNoteId(currentActive.replace(sourceId, newPath));
        }
      }

      log.info("déplacement terminé", { sourceId, newPath, isFolder });
    }
  }

  async function handleExternalDropFromPaths(
    targetFolderPath: string,
    paths: string[],
    skipMedia = false
  ) {
    const vaultPath = store.get(folderPathAtom);
    if (!vaultPath) return;

    // Espace actif → les notes/dossiers importés y sont rattachés (médias non taguables).
    const space = store.get(activeSpaceAtom);

    await Promise.all(
      paths.map(async (srcPath) => {
        const fileName = srcPath.split("/").pop() ?? "";
        // skipMedia : drop sans dropzone (hors arborescence) — les médias sont
        // déjà pris en charge par l'éditeur, ne pas les importer une 2e fois.
        if (skipMedia && getMediaType(fileName)) return;
        try {
          if (fileName.endsWith(".md")) {
            await importMdFile(srcPath, targetFolderPath, space);
          } else if (getMediaType(fileName)) {
            await importMediaFile(srcPath, targetFolderPath, fileName);
          } else {
            // Tenter un import dossier (readDir réussit ssi c'est un répertoire)
            const parts = srcPath.split("/");
            const folderName = fileName || parts[parts.length - 1] || "Dossier";
            try {
              await readDir(srcPath, BASE_NULL);
              await importFolderRecursive(
                srcPath,
                targetFolderPath,
                folderName,
                space
              );
            } catch {
              log.info("chemin ignoré (ni note, ni média, ni dossier)", {
                srcPath,
              });
            }
          }
        } catch (err) {
          log.error("échec import externe", { srcPath, err });
        }
      })
    );

    // Médias droppés à la racine du vault alors qu'un espace est actif : faute de
    // frontmatter, ils ne peuvent pas être rattachés à l'espace → ils restent à la racine.
    if (!skipMedia && space && targetFolderPath === vaultPath) {
      const mediaCount = paths.filter((p) =>
        getMediaType(p.split("/").pop() ?? "")
      ).length;
      if (mediaCount > 0) {
        store.set(
          toastAtom,
          mediaCount > 1
            ? `${mediaCount} médias importés à la racine du vault : un média ne peut pas être rattaché à l'espace « ${space} ».`
            : `Média importé à la racine du vault : il ne peut pas être rattaché à l'espace « ${space} ».`
        );
      }
    }

    cbRef.current.reload();
  }

  return { onPointerDown };
}
