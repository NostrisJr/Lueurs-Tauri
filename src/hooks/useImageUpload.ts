import { invoke } from "@tauri-apps/api/core";

export async function saveImageToResources(
    vaultPath: string,
    file: File
): Promise<string> {
    const data = Array.from(new Uint8Array(await file.arrayBuffer()));
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // Retourne le chemin absolu — stocké tel quel dans le markdown
    return await invoke<string>("save_image", {
        vaultPath,
        filename: safeName,
        data,
    });
}

export async function resolveImagePath(absolutePath: string): Promise<string> {
    return await invoke<string>("read_image", { path: absolutePath });
}