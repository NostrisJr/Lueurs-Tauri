/**
 * fileHash.ts
 *
 * Hash partiel d'un fichier pour détecter les doublons sans lire
 * tout le contenu. Lit les premiers et derniers 64KB + taille + nom.
 *
 * Suffisant pour distinguer des fichiers audio différents en pratique.
 * Utilise SubtleCrypto (dispo dans la webview Tauri sans dépendance).
 */

import { createLogger } from "../lib/logger";

const log = createLogger("fileHash");

const SAMPLE_SIZE = 64 * 1024; // 64 KB

export async function hashFile(file: File): Promise<string> {
    const size = file.size;

    let blob: Blob;
    if (size <= SAMPLE_SIZE * 2) {
        // Fichier petit : on hash tout
        blob = file;
    } else {
        // Fichier grand : début + fin
        const start = file.slice(0, SAMPLE_SIZE);
        const end = file.slice(size - SAMPLE_SIZE);
        const startBytes = await start.arrayBuffer();
        const endBytes = await end.arrayBuffer();

        // Concatène les deux échantillons
        const merged = new Uint8Array(SAMPLE_SIZE * 2);
        merged.set(new Uint8Array(startBytes), 0);
        merged.set(new Uint8Array(endBytes), SAMPLE_SIZE);
        blob = new Blob([merged]);
    }

    const buffer = await blob.arrayBuffer();

    // On mélange aussi taille + nom pour réduire encore les collisions
    const meta = new TextEncoder().encode(`${file.name}:${file.size}`);
    const combined = new Uint8Array(buffer.byteLength + meta.byteLength);
    combined.set(new Uint8Array(buffer), 0);
    combined.set(meta, buffer.byteLength);

    const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
    const hex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 12); // 12 chars suffisent

    log.info("hash calculé", { name: file.name, size: file.size, hash: hex });
    return hex;
}