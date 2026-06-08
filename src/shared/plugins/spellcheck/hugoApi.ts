import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "../../lib/logger";

const log = createLogger("Spellcheck");

/** Suggestion renvoyée par le plugin Tauri `hugo-tauri` (correcteur Hugo). */
export interface HugoSuggestion {
  /** Offset d'octet UTF-8 de début dans le texte source (inclus). */
  start: number;
  /** Offset d'octet UTF-8 de fin (exclu). */
  end: number;
  /** Message explicatif, en français. */
  message: string;
  /** Corrections proposées, triées de la plus à la moins pertinente. */
  replacements: string[];
  /** Identifiant stable de la règle ayant produit la suggestion. */
  ruleId: string;
}

/** Catégorie d'affichage : orthographe (rouge) ou grammaire (bleu). */
export type SpellCategory = "spelling" | "grammar";

export function categoryOf(ruleId: string): SpellCategory {
  return ruleId === "spelling" ? "spelling" : "grammar";
}

/** Vérifie `text` via le correcteur local Hugo. Renvoie [] en cas d'erreur. */
export async function checkText(text: string): Promise<HugoSuggestion[]> {
  try {
    return await invoke<HugoSuggestion[]>("plugin:hugo-tauri|check_text", {
      text,
    });
  } catch (err) {
    log.error("échec de l'appel check_text", err);
    return [];
  }
}

let warmedUp = false;

/**
 * Chauffe le correcteur : le premier appel charge les index morphologiques
 * (paresseux) et est plus lent. On le déclenche à blanc une seule fois.
 */
export async function warmUpSpellcheck(): Promise<void> {
  if (warmedUp) return;
  warmedUp = true;
  log.info("chauffe du correcteur");
  await checkText("Bonjour");
}
