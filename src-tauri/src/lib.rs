use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Emitter;
use tauri_plugin_fs::FsExt;
use tokio::task::JoinSet;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum TemplateChange {
    AddProp { key: String, value: Option<String> },
    RemoveProp { key: String },
    RenameProp { old_key: String, new_key: String, template_value: Option<String> },
    ForceValue { key: String, value: String },
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
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            allow_vault_path,
            copy_resource_to_vault,
            propagate_template_change,
            update_note,
            get_titlebar_height,
            get_scale_factor,
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
async fn update_note(
    app: tauri::AppHandle,
    id: String,
    raw_content: String,
) -> Result<(), String> {
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
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    println!("[allow_vault_path] ✓ {}", vault_path);
    Ok(())
}

#[tauri::command]
async fn copy_resource_to_vault(
    src_path: String,
    vault_path: String,
    sub_dir: String,
    filename: String,
) -> Result<String, String> {
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
        TemplateChange::RenameProp { old_key, new_key, template_value } => TemplateChange::RenameProp {
            old_key: old_key.clone(),
            new_key: new_key.clone(),
            template_value: template_value.clone(),
        },
        TemplateChange::ForceValue { key, value } => TemplateChange::ForceValue {
            key: key.clone(),
            value: value.clone(),
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
        TemplateChange::RenameProp { old_key, new_key, template_value } => {
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
                true
            } else {
                false
            }
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

fn maybe_cleanup_tmp(path: String) {
    if !path.contains("lueurs-tmp") {
        return;
    }
    std::thread::spawn(move || match std::fs::remove_file(&path) {
        Ok(_) => println!("[cleanup_tmp] ✓ supprimé : {}", path),
        Err(e) => println!("[cleanup_tmp] ⚠ échec : {} — {}", path, e),
    });
}
