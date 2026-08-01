//! Correcteur natif macOS (moteur « Apple » du réglage éditeur).
//!
//! Deux rôles distincts, tous deux impossibles à couvrir côté web :
//!
//! 1. **Correction à la frappe / substitutions** (`set_native_text_checking`).
//!    Contrairement à iOS, l'attribut HTML `autocorrect` ne pilote *pas* la
//!    correction automatique sur macOS : WebKit initialise son état de
//!    text-checking depuis les NSUserDefaults du process. Sans écrire ces clés,
//!    l'utilisateur a le soulignement mais jamais la correction automatique.
//!
//! 2. **Suggestions NSSpellChecker** (`native_spell_suggestions`,
//!    `native_learn_word`). Les suggestions macOS vivent normalement dans le
//!    menu contextuel WebKit — que `useContextMenu` remplace par un menu Tauri.
//!    On récupère donc les propositions ici pour les réinjecter dans notre menu.
//!
//! AppKit impose le main thread : tout passe par `run_on_main_thread`.

use cocoa::base::{id, nil, NO, YES};
use cocoa::foundation::{NSInteger, NSRange, NSString, NSUInteger};
use objc::{class, msg_send, sel, sel_impl};
use std::ffi::CStr;
use std::os::raw::c_char;
use tauri::Manager;

/// Clés NSUserDefaults lues par WebKit pour initialiser son text-checking.
/// Volontairement absentes : `WebAutomaticQuoteSubstitutionEnabled` et
/// `WebAutomaticDashSubstitutionEnabled` — elles réécrivent les caractères tapés
/// (guillemets typographiques, tirets cadratins), ce qu'on n'impose pas dans un
/// éditeur Markdown.
const TEXT_CHECKING_KEYS: &[&str] = &[
    // Soulignement rouge des fautes
    "WebContinuousSpellCheckingEnabled",
    // Correction automatique à la frappe
    "WebAutomaticSpellingCorrectionEnabled",
    // Remplacements définis dans Réglages Système › Clavier › Saisie
    "WebAutomaticTextReplacementEnabled",
];

/// Exécute `f` sur le main thread et rapatrie son résultat.
/// La commande appelante est `async` : le blocage sur `recv` ne tient qu'un
/// worker tokio le temps d'un aller-retour, jamais le main thread.
fn on_main<T: Send + 'static>(
    app: &tauri::AppHandle,
    f: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

/// NSString autonome — à libérer explicitement (pas de pool d'autorelease ici).
unsafe fn ns_string(s: &str) -> id {
    NSString::alloc(nil).init_str(s)
}

unsafe fn release(obj: id) {
    if obj != nil {
        let _: () = msg_send![obj, release];
    }
}

unsafe fn ns_string_to_rust(s: id) -> Option<String> {
    if s == nil {
        return None;
    }
    let bytes: *const c_char = msg_send![s, UTF8String];
    if bytes.is_null() {
        return None;
    }
    Some(CStr::from_ptr(bytes).to_string_lossy().into_owned())
}

unsafe fn write_text_checking_defaults(enabled: bool) {
    let defaults: id = msg_send![class!(NSUserDefaults), standardUserDefaults];
    let value = if enabled { YES } else { NO };
    for key in TEXT_CHECKING_KEYS {
        let ns_key = ns_string(key);
        let _: () = msg_send![defaults, setBool: value forKey: ns_key];
        release(ns_key);
    }
}

/// `None` si le mot est correct, `Some(guesses)` s'il est mal orthographié
/// (le vecteur peut être vide : faute détectée sans proposition).
unsafe fn spell_check_word(word: &str) -> Option<Vec<String>> {
    let checker: id = msg_send![class!(NSSpellChecker), sharedSpellChecker];
    if checker == nil {
        return None;
    }
    let ns_word = ns_string(word);
    let start: NSInteger = 0;
    let misspelled: NSRange = msg_send![checker, checkSpellingOfString: ns_word startingAt: start];
    if misspelled.length == 0 {
        release(ns_word);
        return None;
    }

    let tag: NSInteger = 0;
    let guesses: id = msg_send![
        checker,
        guessesForWordRange: misspelled
        inString: ns_word
        language: nil
        inSpellDocumentWithTag: tag
    ];
    let count: NSUInteger = if guesses == nil {
        0
    } else {
        msg_send![guesses, count]
    };
    let mut out = Vec::with_capacity(count as usize);
    for i in 0..count {
        let item: id = msg_send![guesses, objectAtIndex: i];
        if let Some(s) = ns_string_to_rust(item) {
            out.push(s);
        }
    }
    release(ns_word);
    Some(out)
}

unsafe fn learn_word(word: &str) {
    let checker: id = msg_send![class!(NSSpellChecker), sharedSpellChecker];
    if checker == nil {
        return;
    }
    let ns_word = ns_string(word);
    let _: () = msg_send![checker, learnWord: ns_word];
    release(ns_word);
}

// ── Commandes ──────────────────────────────────────────────────────────────

/// Active/désactive la correction automatique WebKit. Appelée par l'éditeur au
/// montage et à chaque changement de moteur.
///
/// Attention : WebKit lit ces defaults paresseusement, à la première
/// utilisation du text-checking dans le process. L'appel au montage de
/// l'éditeur passe donc avant en pratique, mais un basculement en cours de
/// frappe peut ne prendre qu'au redémarrage de l'app.
#[tauri::command]
pub async fn set_native_text_checking(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    on_main(&app, move || unsafe {
        write_text_checking_defaults(enabled)
    })
}

/// Suggestions NSSpellChecker pour un mot isolé.
/// `null` = mot correct (aucun item à afficher dans le menu contextuel).
#[tauri::command]
pub async fn native_spell_suggestions(
    app: tauri::AppHandle,
    word: String,
) -> Result<Option<Vec<String>>, String> {
    on_main(&app, move || unsafe { spell_check_word(&word) })
}

/// Ajoute le mot au dictionnaire utilisateur macOS (équivalent Apple de la
/// liste de mots ignorés de Hugo).
#[tauri::command]
pub async fn native_learn_word(app: tauri::AppHandle, word: String) -> Result<(), String> {
    on_main(&app, move || unsafe { learn_word(&word) })
}
