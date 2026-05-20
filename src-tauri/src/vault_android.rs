// Colle SAF pour Lueurs sur Android.
// Toutes les commandes s'appuient sur tauri-plugin-android-fs (Storage Access Framework).
// Sur les autres plateformes, ce fichier n'est pas compilé : les opérations FS
// passent directement par @tauri-apps/plugin-fs côté JS.

#![cfg(target_os = "android")]

use serde::Serialize;
use tauri_plugin_android_fs::{AndroidFsExt, FileUri};

const LOG: &str = "[vault_android]";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub name: String,
    pub uri: String,
    pub is_dir: bool,
}

// Reconstruit un FileUri en dérivant document_top_tree_uri depuis la structure.
// Sans ça, le plugin route un tree URI vers mediaFileController au lieu de
// documentFileController (cf. AndroidFsPlugin.kt:getFileController).
fn make_file_uri(uri: &str) -> FileUri {
    let top_tree_uri = if let Some(pos) = uri.find("/document/") {
        // URI document → la racine tree est le préfixe avant "/document/"
        Some(uri[..pos].to_string())
    } else if uri.contains("/tree/") {
        // URI tree → c'est lui-même la racine
        Some(uri.to_string())
    } else {
        None
    };
    FileUri {
        uri: uri.to_string(),
        document_top_tree_uri: top_tree_uri,
    }
}

// ── vault_pick_dir ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_pick_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let fs = app.android_fs_async();
    let picked = fs
        .file_picker()
        .pick_dir(None, false)
        .await
        .map_err(|e| {
            eprintln!("{LOG} vault_pick_dir erreur: {e}");
            e.to_string()
        })?;
    match picked {
        Some(uri) => {
            fs.file_picker()
                .persist_uri_permission(&uri)
                .await
                .map_err(|e| {
                    eprintln!("{LOG} vault_pick_dir persist erreur: {e}");
                    e.to_string()
                })?;
            eprintln!("{LOG} vault_pick_dir ok");
            Ok(Some(uri.uri))
        }
        None => {
            eprintln!("{LOG} vault_pick_dir annulé");
            Ok(None)
        }
    }
}

// ── vault_read_dir ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_read_dir(
    app: tauri::AppHandle,
    uri: String,
) -> Result<Vec<VaultEntry>, String> {
    let fs = app.android_fs_async();
    let dir = make_file_uri(&uri);
    let entries = fs.read_dir(&dir).await.map_err(|e| {
        eprintln!("{LOG} vault_read_dir erreur: {e}");
        e.to_string()
    })?;
    let result: Vec<VaultEntry> = entries
        .iter()
        .map(|e| VaultEntry {
            name: e.name().to_string(),
            uri: e.uri().uri.clone(),
            is_dir: e.is_dir(),
        })
        .collect();
    eprintln!("{LOG} vault_read_dir ok ({} entrées)", result.len());
    Ok(result)
}

// ── vault_read_file ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_read_file(app: tauri::AppHandle, uri: String) -> Result<String, String> {
    let fs = app.android_fs_async();
    let file = make_file_uri(&uri);
    let result = fs.read_to_string(&file).await.map_err(|e| {
        eprintln!("{LOG} vault_read_file erreur: {e}");
        e.to_string()
    })?;
    eprintln!("{LOG} vault_read_file ok");
    Ok(result)
}

// ── vault_write_file ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_write_file(
    app: tauri::AppHandle,
    uri: String,
    content: String,
) -> Result<(), String> {
    let fs = app.android_fs_async();
    let file = make_file_uri(&uri);
    fs.write(&file, content.as_bytes()).await.map_err(|e| {
        eprintln!("{LOG} vault_write_file erreur: {e}");
        e.to_string()
    })?;
    eprintln!("{LOG} vault_write_file ok");
    Ok(())
}

// ── vault_create_file ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_create_file(
    app: tauri::AppHandle,
    parent_uri: String,
    name: String,
) -> Result<String, String> {
    let fs = app.android_fs_async();
    let parent = make_file_uri(&parent_uri);
    let new = fs
        .create_new_file(&parent, std::path::Path::new(&name), Some("text/markdown"))
        .await
        .map_err(|e| {
            eprintln!("{LOG} vault_create_file erreur: {e}");
            e.to_string()
        })?;
    eprintln!("{LOG} vault_create_file ok");
    Ok(new.uri)
}

// ── vault_create_dir ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_create_dir(
    app: tauri::AppHandle,
    parent_uri: String,
    name: String,
) -> Result<String, String> {
    let fs = app.android_fs_async();
    let parent = make_file_uri(&parent_uri);
    let new = fs
        .create_dir_all(&parent, std::path::Path::new(&name))
        .await
        .map_err(|e| {
            eprintln!("{LOG} vault_create_dir erreur: {e}");
            e.to_string()
        })?;
    eprintln!("{LOG} vault_create_dir ok");
    Ok(new.uri)
}

// ── vault_rename ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_rename(
    app: tauri::AppHandle,
    uri: String,
    new_name: String,
) -> Result<String, String> {
    let fs = app.android_fs_async();
    let file = make_file_uri(&uri);
    let new_uri = fs.rename(&file, new_name.as_str()).await.map_err(|e| {
        eprintln!("{LOG} vault_rename erreur: {e}");
        e.to_string()
    })?;
    eprintln!("{LOG} vault_rename ok");
    Ok(new_uri.uri)
}

// ── copy_to_vault ─────────────────────────────────────────────────────────────
// Copie un fichier POSIX (typiquement le cache du plugin audio-recorder) vers
// resources/<sub_dir>/<filename> sous l'arbre SAF du vault. Retourne le chemin
// relatif logique sanitisé par SAF (ex: "resources/audio/file.m4a") — identique
// à ce qu'on stocke sur desktop/iOS dans le markdown.

pub async fn copy_to_vault_android(
    app: tauri::AppHandle,
    src_path: String,
    vault_uri: String,
    sub_dir: String,
    filename: String,
) -> Result<String, String> {
    let bytes = tokio::fs::read(&src_path)
        .await
        .map_err(|e| format!("read src: {e}"))?;
    let fs = app.android_fs_async();
    let vault = make_file_uri(&vault_uri);
    let rel_path = format!("resources/{sub_dir}/{filename}");
    let mime = mime_for_filename(&filename);
    let (new_uri, sanitized_rel) = fs
        .create_new_file_and_return_relative_path(
            &vault,
            std::path::Path::new(&rel_path),
            mime,
        )
        .await
        .map_err(|e| {
            eprintln!("{LOG} copy_to_vault create_new_file erreur: {e}");
            e.to_string()
        })?;
    fs.write(&new_uri, &bytes).await.map_err(|e| {
        eprintln!("{LOG} copy_to_vault write erreur: {e}");
        e.to_string()
    })?;
    let _ = tokio::fs::remove_file(&src_path).await;
    let rel_str = sanitized_rel.to_string_lossy().to_string();
    eprintln!("{LOG} copy_to_vault ok ({} octets) → {rel_str}", bytes.len());
    Ok(rel_str)
}

// Résout un chemin relatif au vault en URI SAF (lecture de l'audio/image existant).
#[tauri::command]
pub async fn vault_resolve_relative(
    app: tauri::AppHandle,
    vault_uri: String,
    rel_path: String,
) -> Result<String, String> {
    let fs = app.android_fs_async();
    let dir = make_file_uri(&vault_uri);
    let uri = fs
        .resolve_file_uri(&dir, std::path::Path::new(&rel_path))
        .await
        .map_err(|e| {
            eprintln!("{LOG} vault_resolve_relative erreur: {e}");
            e.to_string()
        })?;
    Ok(uri.uri)
}

// Lecture binaire d'un fichier SAF. Retourne un ArrayBuffer côté JS via
// tauri::ipc::Response — évite la sérialisation JSON (array of numbers) lourde.
#[tauri::command]
pub async fn vault_read_bytes(
    app: tauri::AppHandle,
    uri: String,
) -> Result<tauri::ipc::Response, String> {
    let fs = app.android_fs_async();
    let file = make_file_uri(&uri);
    let bytes = fs.read(&file).await.map_err(|e| {
        eprintln!("{LOG} vault_read_bytes erreur: {e}");
        e.to_string()
    })?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn mime_for_filename(filename: &str) -> Option<&'static str> {
    let ext = filename.rsplit('.').next()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "m4a" | "aac" => "audio/mp4",
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        _ => return None,
    })
}

// ── vault_delete ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_delete(app: tauri::AppHandle, uri: String) -> Result<(), String> {
    let fs = app.android_fs_async();
    let file = make_file_uri(&uri);
    let is_dir = fs.get_type(&file).await.map(|t| t.is_dir()).unwrap_or(false);
    if is_dir {
        fs.remove_dir_all(&file).await.map_err(|e| {
            eprintln!("{LOG} vault_delete (dir) erreur: {e}");
            e.to_string()
        })?;
    } else {
        fs.remove_file(&file).await.map_err(|e| {
            eprintln!("{LOG} vault_delete (file) erreur: {e}");
            e.to_string()
        })?;
    }
    eprintln!("{LOG} vault_delete ok");
    Ok(())
}
