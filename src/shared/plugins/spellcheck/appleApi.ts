import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "../../lib/logger";
import { isMacOS } from "../../lib/platform";

const log = createLogger("SpellcheckApple");

/**
 * Active/désactive la correction automatique à la frappe de WebKit (macOS).
 * L'attribut HTML `autocorrect` ne suffit pas sur macOS : WebKit lit son état
 * de text-checking dans les NSUserDefaults du process (cf. macos_spellcheck.rs).
 * No-op ailleurs — iOS pilote tout via les attributs du contenteditable.
 */
export async function setNativeTextChecking(enabled: boolean): Promise<void> {
  if (!isMacOS) return;
  try {
    await invoke("set_native_text_checking", { enabled });
    log.info("text-checking natif mis à jour", { enabled });
  } catch (err) {
    log.error("échec set_native_text_checking", err);
  }
}

/**
 * Suggestions NSSpellChecker pour un mot isolé.
 * `null` = mot correct ; `[]` = faute sans proposition.
 */
export async function nativeSpellSuggestions(
  word: string
): Promise<string[] | null> {
  if (!isMacOS) return null;
  try {
    return await invoke<string[] | null>("native_spell_suggestions", { word });
  } catch (err) {
    log.error("échec native_spell_suggestions", err);
    return null;
  }
}

/** Ajoute le mot au dictionnaire utilisateur macOS. */
export async function nativeLearnWord(word: string): Promise<void> {
  if (!isMacOS) return;
  try {
    await invoke("native_learn_word", { word });
    log.info("mot ajouté au dictionnaire macOS", { word });
  } catch (err) {
    log.error("échec native_learn_word", err);
  }
}
