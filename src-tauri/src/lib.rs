use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri_plugin_fs::FsExt;
use tokio::task::JoinSet;

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum TemplateChange {
    AddProp { key: String, value: Option<String> },
    RemoveProp { key: String },
    RenameProp { old_key: String, new_key: String },
    ForceValue { key: String, value: String },
}

#[derive(Debug, Serialize)]
struct PropagateResult {
    modified: usize,
    errors: Vec<String>,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Commandes ──────────────────────────────────────────────────────────────

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
        TemplateChange::RenameProp { old_key, new_key } => TemplateChange::RenameProp {
            old_key: old_key.clone(),
            new_key: new_key.clone(),
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

    // RenameProp : remplacement direct dans le contenu brut pour préserver la valeur existante
    if let TemplateChange::RenameProp { old_key, new_key } = change {
        let new_content = rename_key_in_content(&content, old_key, new_key);
        if new_content == content {
            return Ok(false);
        }
        tokio::fs::write(path, new_content)
            .await
            .map_err(|e| format!("{}: {}", path.display(), e))?;
        return Ok(true);
    }

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

/// Remplace `old_key:` par `new_key:` dans le bloc frontmatter uniquement.
/// Opère sur le texte brut pour préserver la valeur existante de chaque note.
fn rename_key_in_content(content: &str, old_key: &str, new_key: &str) -> String {
    // On ne cherche que dans le bloc frontmatter (entre les deux ---)
    let (Some(fm_raw), body) = split_frontmatter(content) else {
        return content.to_string();
    };

    // Chercher la ligne `old_key:` ou `old_key: valeur` dans le frontmatter
    let target = format!("{}:", old_key);
    let replacement = format!("{}:", new_key);

    let new_fm = fm_raw
        .lines()
        .map(|line| {
            // Correspondance exacte sur le début de ligne (évite de renommer un sous-champ)
            if line == target
                || line.starts_with(&format!("{} ", target))
                || line.starts_with(&target)
            {
                line.replacen(&target, &replacement, 1)
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let new_fm_terminated = if new_fm.ends_with('\n') {
        new_fm
    } else {
        new_fm + "\n"
    };
    format!("---\n{}---\n{}", new_fm_terminated, body)
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
        TemplateChange::RenameProp { old_key, new_key } => {
            if let Some(val) = fm.shift_remove(old_key.as_str()) {
                fm.insert(new_key.clone(), val);
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
