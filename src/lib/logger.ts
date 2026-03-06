/**
 * logger.ts
 *
 * Logger structuré avec préfixes par module et niveaux de log.
 * Désactivé automatiquement en production (import.meta.env.PROD).
 *
 * Usage :
 *   import { createLogger } from "../lib/logger";
 *   const log = createLogger("audio-block");
 *
 *   log.info("fichier reçu", { name: file.name, size: file.size });
 *   log.warn("chemin inattendu", { src });
 *   log.error("échec upload", err);
 */

const IS_DEV = import.meta.env.DEV;

type LogLevel = "info" | "warn" | "error";

interface Logger {
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
}

export function createLogger(module: string): Logger {
    const prefix = `[${module}]`;

    function log(level: LogLevel, message: string, data?: unknown) {
        if (!IS_DEV && level === "info") return;

        const args: unknown[] = [`${prefix} ${message}`];
        if (data !== undefined) args.push(data);

        if (level === "error") console.error(...args);
        else if (level === "warn") console.warn(...args);
        else console.log(...args);
    }

    return {
        info: (msg, data) => log("info", msg, data),
        warn: (msg, data) => log("warn", msg, data),
        error: (msg, data) => log("error", msg, data),
    };
}