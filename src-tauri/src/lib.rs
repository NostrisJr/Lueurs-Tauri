use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;
use tokio::task::JoinSet;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg(target_os = "android")]
mod vault_android;
#[cfg(target_os = "android")]
use vault_android::*;

#[cfg(target_os = "macos")]
mod macos_window;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum TemplateChange {
    AddProp {
        key: String,
        value: Option<String>,
    },
    RemoveProp {
        key: String,
    },
    RenameProp {
        old_key: String,
        new_key: String,
        template_value: Option<String>,
    },
    ForceValue {
        key: String,
        value: String,
    },
    // Renommage d'une valeur permise dans un BUTTON : met à jour les héritiers
    // dont la propriété vaut exactement old_value.
    RenameEnumValue {
        key: String,
        old_value: String,
        new_value: String,
    },
    // Réconciliation BUTTON : écrase par le default toute valeur non permise.
    EnforceEnum {
        key: String,
        options: Vec<String>,
        default: String,
    },
}

#[derive(Debug, Serialize)]
struct PropagateResult {
    modified: usize,
    errors: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
struct NotePatch {
    id: String,
    raw_content: String,
}

// ── Entrée Tauri ───────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Le plugin android-fs doit être enregistré sur le Builder (avant setup)
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_audio_recorder::init())
        .plugin(tauri_plugin_native_audio::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(tauri_plugin_android_fs::init());
    }

    builder
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").unwrap();
                let radius = macos_window::CORNER_RADIUS;
                // 4e arg = rayon des coins : arrondit la vue de vibrancy (fond visible).
                apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::FullScreenUI,
                    None,
                    Some(radius),
                )
                .expect("Vibrancy non supportée");
                // Clippe le contentView au même rayon pour que le webview suive l'arrondi.
                if let Err(e) = macos_window::apply_corner_radius(&window, radius) {
                    eprintln!("[macos_window] arrondi non appliqué : {}", e);
                }
            }
            #[cfg(target_os = "ios")]
            {
                extern "C" {
                    fn setup_keyboard_behavior();
                }
                unsafe { setup_keyboard_behavior() };

                tauri::async_runtime::spawn(async {
                    let path = get_icloud_path().await;
                    eprintln!("[icloud] container path: {:?}", path);
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            allow_vault_path,
            copy_resource_to_vault,
            propagate_template_change,
            update_note,
            get_titlebar_height,
            get_scale_factor,
            get_icloud_path,
            get_icloud_path_macos,
            show_action_sheet,
            show_rename_prompt,
            #[cfg(target_os = "android")]
            vault_pick_dir,
            #[cfg(target_os = "android")]
            vault_read_dir,
            #[cfg(target_os = "android")]
            vault_read_file,
            #[cfg(target_os = "android")]
            vault_write_file,
            #[cfg(target_os = "android")]
            vault_create_file,
            #[cfg(target_os = "android")]
            vault_create_dir,
            #[cfg(target_os = "android")]
            vault_rename,
            #[cfg(target_os = "android")]
            vault_delete,
            #[cfg(target_os = "android")]
            vault_resolve_relative,
            #[cfg(target_os = "android")]
            vault_read_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Commandes ──────────────────────────────────────────────────────────────

/// Hauteur de la titlebar macOS en pixels physiques.
/// Permet au frontend de corriger les coordonnées du drop externe (wry les exprime
/// dans le frame de la fenêtre macOS, title bar incluse, et non dans le viewport WebView).
#[tauri::command]
fn get_titlebar_height(window: tauri::Window) -> f64 {
    let outer = window.outer_position().unwrap_or_default();
    let inner = window.inner_position().unwrap_or_default();
    (inner.y - outer.y) as f64
}

/// DPR (device pixel ratio) de la fenêtre, identique à window.devicePixelRatio côté JS.
#[tauri::command]
fn get_scale_factor(window: tauri::Window) -> f64 {
    window.scale_factor().unwrap_or(1.0)
}

/// Écrit une note sur le disque et émet un événement vault:patch pour que le frontend
/// réconcilie son état sans recharger tout l'arbre.
#[tauri::command]
async fn update_note(app: tauri::AppHandle, id: String, raw_content: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&id);
    tokio::fs::write(&path, raw_content.as_bytes())
        .await
        .map_err(|e| format!("{}: {}", path.display(), e))?;

    app.emit("vault:patch", vec![NotePatch { id, raw_content }])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn allow_vault_path(app: tauri::AppHandle, vault_path: String) -> Result<(), String> {
    let path = PathBuf::from(&vault_path);
    // Scope filesystem (lecture/écriture via plugin-fs)
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    // Scope asset:// (chargement d'images et d'audio dans la webview)
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    println!("[allow_vault_path] ✓ {}", vault_path);
    Ok(())
}

#[tauri::command]
async fn copy_resource_to_vault(
    #[allow(unused_variables)] app: tauri::AppHandle,
    src_path: String,
    vault_path: String,
    sub_dir: String,
    filename: String,
) -> Result<String, String> {
    // Sur Android, le vault_path est une URI SAF — on passe par tauri-plugin-android-fs.
    #[cfg(target_os = "android")]
    {
        return copy_to_vault_android(app, src_path, vault_path, sub_dir, filename).await;
    }
    #[cfg(not(target_os = "android"))]
    {
        let dest_dir = PathBuf::from(&vault_path).join("resources").join(&sub_dir);
        std::fs::create_dir_all(&dest_dir).map_err(|e| format!("create_dir_all: {}", e))?;
        let dest = dest_dir.join(&filename);
        if dest.exists() {
            maybe_cleanup_tmp(src_path);
            return Ok(dest.to_string_lossy().to_string());
        }
        std::fs::copy(&src_path, &dest).map_err(|e| format!("copy: {}", e))?;
        maybe_cleanup_tmp(src_path);
        Ok(dest.to_string_lossy().to_string())
    }
}

/// Propage un changement de template aux notes héritières.
/// Le frontend calcule et passe la liste complète des chemins affectés,
/// Rust se charge uniquement du traitement parallèle des fichiers.
#[tauri::command]
async fn propagate_template_change(
    affected_paths: Vec<String>,
    change: TemplateChange,
) -> Result<PropagateResult, String> {
    println!(
        "[propagate_template_change] {:?} sur {} fichiers",
        change,
        affected_paths.len()
    );

    let mut set = JoinSet::new();

    for path_str in affected_paths {
        let change_ref = clone_change(&change);
        set.spawn(async move {
            let path = PathBuf::from(&path_str);
            process_file(&path, &change_ref).await
        });
    }

    let mut modified = 0;
    let mut errors = Vec::new();

    while let Some(res) = set.join_next().await {
        match res {
            Ok(Ok(true)) => modified += 1,
            Ok(Ok(false)) => {}
            Ok(Err(e)) => errors.push(e),
            Err(e) => errors.push(format!("join error: {}", e)),
        }
    }

    println!(
        "[propagate_template_change] ✓ {} fichiers modifiés, {} erreurs",
        modified,
        errors.len()
    );
    Ok(PropagateResult { modified, errors })
}

// ── Helpers ───────────────────────────────────────────────────────────────

fn clone_change(change: &TemplateChange) -> TemplateChange {
    match change {
        TemplateChange::AddProp { key, value } => TemplateChange::AddProp {
            key: key.clone(),
            value: value.clone(),
        },
        TemplateChange::RemoveProp { key } => TemplateChange::RemoveProp { key: key.clone() },
        TemplateChange::RenameProp {
            old_key,
            new_key,
            template_value,
        } => TemplateChange::RenameProp {
            old_key: old_key.clone(),
            new_key: new_key.clone(),
            template_value: template_value.clone(),
        },
        TemplateChange::ForceValue { key, value } => TemplateChange::ForceValue {
            key: key.clone(),
            value: value.clone(),
        },
        TemplateChange::RenameEnumValue {
            key,
            old_value,
            new_value,
        } => TemplateChange::RenameEnumValue {
            key: key.clone(),
            old_value: old_value.clone(),
            new_value: new_value.clone(),
        },
        TemplateChange::EnforceEnum {
            key,
            options,
            default,
        } => TemplateChange::EnforceEnum {
            key: key.clone(),
            options: options.clone(),
            default: default.clone(),
        },
    }
}

// ── Logique de traitement par fichier ──────────────────────────────────────

/// Retourne true si le fichier a été modifié.
async fn process_file(path: &Path, change: &TemplateChange) -> Result<bool, String> {
    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("{}: {}", path.display(), e))?;

    let (frontmatter_raw, body) = split_frontmatter(&content);
    let mut fm: indexmap::IndexMap<String, serde_yaml::Value> = match frontmatter_raw {
        Some(raw) => serde_yaml::from_str(raw).unwrap_or_default(),
        None => return Ok(false),
    };

    if !apply_change(&mut fm, change) {
        return Ok(false);
    }

    let new_content = rebuild_content(&fm, body);
    tokio::fs::write(path, new_content)
        .await
        .map_err(|e| format!("{}: {}", path.display(), e))?;

    Ok(true)
}

fn apply_change(
    fm: &mut indexmap::IndexMap<String, serde_yaml::Value>,
    change: &TemplateChange,
) -> bool {
    match change {
        TemplateChange::AddProp { key, value } => {
            if fm.contains_key(key.as_str()) {
                return false; // déjà présente, on ne touche pas
            }
            let v = value
                .as_deref()
                .map(|s| serde_yaml::Value::String(s.to_string()))
                .unwrap_or(serde_yaml::Value::String(String::new()));
            fm.insert(key.clone(), v);
            true
        }
        TemplateChange::RemoveProp { key } => fm.shift_remove(key.as_str()).is_some(),
        TemplateChange::RenameProp {
            old_key,
            new_key,
            template_value,
        } => {
            let mut modified = false;

            if let Some(old_val) = fm.shift_remove(old_key.as_str()) {
                if fm.contains_key(new_key.as_str()) {
                    // Conflit : new_key existe déjà dans la note
                    match template_value {
                        Some(tv) if !tv.is_empty() => {
                            // Propriété imposée : la valeur du template prime
                            fm.insert(new_key.clone(), serde_yaml::Value::String(tv.clone()));
                        }
                        _ => {
                            // Propriété contraignante : old_key avait une valeur → elle prime
                            // old_key vide → adopter la valeur existante de new_key
                            let old_is_empty = match &old_val {
                                serde_yaml::Value::String(s) => s.is_empty(),
                                serde_yaml::Value::Null => true,
                                _ => false,
                            };
                            if !old_is_empty {
                                fm.insert(new_key.clone(), old_val);
                            }
                        }
                    }
                } else {
                    // Pas de conflit : renommage simple, préserver la valeur de old_key
                    fm.insert(new_key.clone(), old_val);
                }
                modified = true;
            }

            // Mettre à jour les références self.old_key et agg(old_key,...) dans les formules
            for value in fm.values_mut() {
                if let serde_yaml::Value::String(s) = value {
                    if s.starts_with("$$") && s.ends_with("$$") {
                        let updated = update_formula_refs(s, old_key, new_key);
                        if updated != *s {
                            *s = updated;
                            modified = true;
                        }
                    }
                }
            }

            modified
        }
        TemplateChange::ForceValue { key, value } => {
            let new_val = serde_yaml::Value::String(value.clone());
            match fm.get_mut(key.as_str()) {
                Some(existing) if *existing != new_val => {
                    *existing = new_val;
                    true
                }
                Some(_) => false, // valeur déjà correcte
                None => {
                    // Clé absente : l'insérer (cas d'une note créée avant l'ajout de la prop au template)
                    fm.insert(key.clone(), new_val);
                    true
                }
            }
        }
        TemplateChange::RenameEnumValue {
            key,
            old_value,
            new_value,
        } => match fm.get_mut(key.as_str()) {
            Some(serde_yaml::Value::String(s)) if s == old_value => {
                *s = new_value.clone();
                true
            }
            _ => false,
        },
        TemplateChange::EnforceEnum {
            key,
            options,
            default,
        } => {
            let needs_reset = matches!(
                fm.get(key.as_str()),
                Some(serde_yaml::Value::String(s)) if !options.contains(s) && s != default
            );
            if needs_reset {
                fm.insert(key.clone(), serde_yaml::Value::String(default.clone()));
                true
            } else {
                false
            }
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/// Sépare le frontmatter YAML du corps. Retourne (Some(yaml_str), body).
fn split_frontmatter(content: &str) -> (Option<&str>, &str) {
    if !content.starts_with("---") {
        return (None, content);
    }
    let rest = &content[3..];
    // Chercher la ligne --- fermante
    if let Some(idx) = rest.find("\n---") {
        let yaml = &rest[..idx].trim_start_matches('\n');
        let body = &rest[idx + 4..];
        let body = body.strip_prefix('\n').unwrap_or(body);
        (Some(yaml), body)
    } else {
        (None, content)
    }
}

fn rebuild_content(fm: &indexmap::IndexMap<String, serde_yaml::Value>, body: &str) -> String {
    let mut lines = Vec::new();
    for (key, value) in fm {
        let serialized_value = yaml_value_to_str(value);
        if serialized_value.is_empty() {
            lines.push(format!("{}:", key));
        } else {
            lines.push(format!("{}: {}", key, serialized_value));
        }
    }
    let yaml = lines.join("\n");
    format!("---\n{}\n---\n{}", yaml, body)
}

/// Sérialise une valeur YAML en string sans quotes superflus ni "null".
fn yaml_value_to_str(value: &serde_yaml::Value) -> String {
    match value {
        serde_yaml::Value::Null => String::new(),
        serde_yaml::Value::Bool(b) => b.to_string(),
        serde_yaml::Value::Number(n) => n.to_string(),
        serde_yaml::Value::String(s) => {
            // Ajouter des quotes seulement si nécessaire (contient : ou # ou commence par espace)
            if s.is_empty() {
                String::new()
            } else if s.contains(':')
                || s.contains('#')
                || s.starts_with(' ')
                || s.starts_with('\'')
            {
                format!("\"{}\"", s.replace('"', "\\\""))
            } else {
                s.clone()
            }
        }
        serde_yaml::Value::Sequence(seq) => {
            let items: Vec<String> = seq
                .iter()
                .map(|v| format!("\n  - {}", yaml_value_to_str(v)))
                .collect();
            items.join("")
        }
        serde_yaml::Value::Mapping(_) => {
            // Cas non supporté pour l'instant
            String::new()
        }
        _ => String::new(),
    }
}

/// Remplace toutes les occurrences de `from` dans `s` qui ne sont pas suivies d'un caractère
/// de mot (`[A-Za-z0-9_]`), pour éviter les faux positifs sur des noms préfixés.
fn replace_with_boundary(s: &str, from: &str, to: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut remaining = s;
    while let Some(idx) = remaining.find(from) {
        let after = &remaining[idx + from.len()..];
        let next_is_word = after
            .chars()
            .next()
            .map_or(false, |c| c.is_alphanumeric() || c == '_');
        if next_is_word {
            // Faux positif (préfixe) — avancer d'un caractère et réessayer
            result.push_str(&remaining[..idx + 1]);
            remaining = &remaining[idx + 1..];
        } else {
            result.push_str(&remaining[..idx]);
            result.push_str(to);
            remaining = after;
        }
    }
    result.push_str(remaining);
    result
}

/// Met à jour les références à old_key dans une formule $$...$$.
/// Cible : `self.old_key` et `agg(old_key,`.
fn update_formula_refs(formula: &str, old_key: &str, new_key: &str) -> String {
    let self_old = format!("self.{}", old_key);
    let self_new = format!("self.{}", new_key);
    let agg_old = format!("agg({},", old_key);
    let agg_new = format!("agg({},", new_key);

    // self.old_key : vérification de frontière (évite self.oldKey2)
    let s = replace_with_boundary(formula, &self_old, &self_new);
    // agg(old_key, : la virgule est déjà un délimiteur, pas de faux positif possible
    s.replace(&agg_old, &agg_new)
}

// ── iCloud macOS ──────────────────────────────────────────────────────────

/// Vérifie si le conteneur iCloud de l'app existe sur macOS (sans le créer).
/// Retourne Some(chemin) si le dossier est présent, None sinon.
#[tauri::command]
async fn get_icloud_path_macos() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        let path = format!(
            "{}/Library/Mobile Documents/iCloud~com~md~lueurs/Documents",
            home
        );
        if std::path::Path::new(&path).exists() {
            eprintln!("[icloud-mac] conteneur trouvé : {}", path);
            Some(path)
        } else {
            eprintln!("[icloud-mac] conteneur absent : {}", path);
            None
        }
    }
    #[cfg(not(target_os = "macos"))]
    None
}

// ── iCloud (iOS uniquement) ────────────────────────────────────────────────

/// Retourne le chemin du dossier Documents dans le conteneur iCloud ubiquity,
/// ou None si iCloud est indisponible (simulateur, non connecté, entitlements absents).
#[tauri::command]
async fn get_icloud_path() -> Option<String> {
    icloud_path_impl().await
}

#[cfg(target_os = "ios")]
async fn icloud_path_impl() -> Option<String> {
    extern "C" {
        fn get_icloud_documents_path(buffer: *mut std::os::raw::c_char, max_len: i32) -> i32;
    }

    tokio::task::spawn_blocking(|| {
        // Appel potentiellement bloquant — doit être hors du thread principal et du thread Tokio
        let mut buffer = vec![0i8; 4096];
        let len = unsafe { get_icloud_documents_path(buffer.as_mut_ptr(), 4096) };
        if len <= 0 {
            return None;
        }
        let cstr = unsafe { std::ffi::CStr::from_ptr(buffer.as_ptr()) };
        Some(cstr.to_string_lossy().into_owned())
    })
    .await
    .ok()
    .flatten()
}

#[cfg(target_os = "macos")]
async fn icloud_path_impl() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = format!(
        "{}/Library/Mobile Documents/iCloud~com~theophiledonato~lueurs/Documents",
        home
    );
    std::fs::create_dir_all(&path).ok();
    Some(path)
}

#[cfg(not(any(target_os = "ios", target_os = "macos")))]
async fn icloud_path_impl() -> Option<String> {
    None
}

// ── UI native iOS ──────────────────────────────────────────────────────────

/// Affiche un UIAlertController (.actionSheet) natif iOS.
/// Retourne l'index du bouton sélectionné, ou -1 si annulé.
/// Sur toute autre plateforme, retourne immédiatement -1.
#[tauri::command]
#[allow(unused_variables)]
async fn show_action_sheet(title: Option<String>, actions: Vec<String>) -> i32 {
    #[cfg(target_os = "ios")]
    {
        extern "C" {
            fn show_ios_action_sheet(json: *const std::os::raw::c_char, result: *mut i32);
        }

        #[derive(serde::Serialize)]
        struct Payload {
            title: Option<String>,
            actions: Vec<String>,
        }
        let json = match serde_json::to_string(&Payload { title, actions }) {
            Ok(j) => j,
            Err(_) => return -1,
        };

        return tokio::task::spawn_blocking(move || {
            let c_json = match std::ffi::CString::new(json) {
                Ok(s) => s,
                Err(_) => return -1,
            };
            let mut result: i32 = -1;
            unsafe { show_ios_action_sheet(c_json.as_ptr(), &mut result) };
            result
        })
        .await
        .unwrap_or(-1);
    }
    #[cfg(not(target_os = "ios"))]
    -1
}

/// Affiche un UIAlertController (.alert) avec champ de texte natif iOS.
/// Retourne le nouveau nom saisi, ou None si annulé.
#[tauri::command]
#[allow(unused_variables)]
async fn show_rename_prompt(
    title: Option<String>,
    placeholder: Option<String>,
    current: Option<String>,
) -> Option<String> {
    #[cfg(target_os = "ios")]
    {
        extern "C" {
            fn show_ios_rename_prompt(
                json: *const std::os::raw::c_char,
                result_buffer: *mut std::os::raw::c_char,
                max_len: i32,
            ) -> i32;
        }

        #[derive(serde::Serialize)]
        struct Payload {
            title: Option<String>,
            placeholder: Option<String>,
            current: Option<String>,
        }
        let json = match serde_json::to_string(&Payload {
            title,
            placeholder,
            current,
        }) {
            Ok(j) => j,
            Err(_) => return None,
        };

        return tokio::task::spawn_blocking(move || {
            let c_json = match std::ffi::CString::new(json) {
                Ok(s) => s,
                Err(_) => return None,
            };
            let mut buffer = vec![0i8; 1024];
            let len = unsafe { show_ios_rename_prompt(c_json.as_ptr(), buffer.as_mut_ptr(), 1024) };
            if len <= 0 {
                return None;
            }
            let cstr = unsafe { std::ffi::CStr::from_ptr(buffer.as_ptr()) };
            Some(cstr.to_string_lossy().into_owned())
        })
        .await
        .unwrap_or(None);
    }
    #[cfg(not(target_os = "ios"))]
    None
}

fn maybe_cleanup_tmp(path: String) {
    if !path.contains("lueurs-tmp") {
        return;
    }
    std::thread::spawn(move || match std::fs::remove_file(&path) {
        Ok(_) => println!("[cleanup_tmp] ✓ supprimé : {}", path),
        Err(e) => println!("[cleanup_tmp] ⚠ échec : {} — {}", path, e),
    });
}
