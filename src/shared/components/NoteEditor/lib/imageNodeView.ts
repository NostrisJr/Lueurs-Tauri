/**
 * imageNodeView.ts — NodeView ProseMirror pour les images.
 *
 * Desktop : convertit les chemins absolus en asset:// via convertFileSrc.
 * Android (SAF) : lit les octets via Rust et génère un blob URL révoqué au destroy.
 * Le chemin absolu est conservé dans le markdown ; seul le rendu DOM change.
 */
import { $prose } from "@milkdown/kit/utils";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { isAndroid } from "../../../lib/platform";
import { createLogger } from "../../../lib/logger";

const log = createLogger("imageNodeView");

const isAbsolutePath = (s: string) => s.startsWith("/") || /^[A-Z]:\\/i.test(s);

/** Résout `rel` (relatif au vault) vers un URI SAF, puis lit les octets via Rust. */
export async function readVaultBytesAndroid(
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

export function makeImageNodeViewBuilder(vaultPath: string) {
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

export function makeImageNodeViewPlugin(vaultPath: string) {
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
