import { invoke } from "@tauri-apps/api/core";
import { Crepe } from "@milkdown/crepe";
import { resolveImagePath } from "../hooks/useImageUpload";
import { createLogger } from "../../../lib/logger";

const log = createLogger("useCrepeConfig");

export function useCrepeConfig(vaultPath: string) {
    //@ts-ignore
    const featureConfigs: ConstructorParameters<typeof Crepe>[0]["featureConfigs"] = {
        [Crepe.Feature.ImageBlock]: {
            onUpload: async (file: File) => {
                log.info("onUpload image", { name: file.name });
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
                    log.info("image sauvegardée", { destPath });
                    return destPath;
                } catch (err) {
                    log.error("échec onUpload image", err);
                    throw err;
                }
            },

            proxyDomURL: async (url: string) => {
                // Convertit un chemin absolu en URL asset:// lisible par la webview
                if (url.startsWith("/") || /^[A-Z]:\\/i.test(url)) {
                    return await resolveImagePath(url);
                }
                return url;
            },
        },
    };

    return { featureConfigs };
}