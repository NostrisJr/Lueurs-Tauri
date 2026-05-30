// Listener drop natif Tauri — singleton enregistré au montage de DesktopApp.
// La ref est partagée : useDropHandler la peuple à chaque montage de MarkdownEditor.

import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createLogger } from "../../../lib/logger";

const log = createLogger("dropListener");

type DropHandler = (paths: string[]) => void;
export const dropHandlerRef: { current: DropHandler | null } = {
  current: null,
};

export async function registerDropListener(): Promise<() => void> {
  const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    if (!dropHandlerRef.current) return;
    // Les .md sont gérés par useFileDrop — ne traiter que audio/images
    const paths = (event.payload.paths ?? []).filter(
      (p: string) => !p.endsWith(".md")
    );
    if (!paths.length) return;
    log.info("drop natif reçu", { paths });
    dropHandlerRef.current(paths);
  });
  log.info("listener drop singleton enregistré");
  return unlisten;
}
