#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_image, read_image, read_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn save_image(vault_path: String, filename: String, data: Vec<u8>) -> Result<String, String> {
    let resources_dir = std::path::PathBuf::from(&vault_path).join(".resources");
    std::fs::create_dir_all(&resources_dir).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(&filename)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let stem = std::path::Path::new(&filename)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let hash = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        data.hash(&mut h);
        format!("{:x}", h.finish())
    };

    let final_name = format!("{}-{}.{}", stem, &hash[..8], ext);
    let dest = resources_dir.join(&final_name);

    if !dest.exists() {
        std::fs::write(&dest, &data).map_err(|e| e.to_string())?;
    }

    // Retourne le chemin absolu — l'affichage sera géré séparément
    Ok(dest.to_string_lossy().to_string())
}

// Nouvelle commande pour lire une image depuis le FS
#[tauri::command]
async fn read_image(path: String) -> Result<String, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(&path)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };

    use base64::{engine::general_purpose, Engine as _};
    Ok(format!(
        "data:{};base64,{}",
        mime,
        general_purpose::STANDARD.encode(&data)
    ))
}

#[tauri::command]
async fn read_audio(path: String) -> Result<String, String> {
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(&path)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    let mime = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        _ => "audio/mpeg",
    };

    use base64::{engine::general_purpose, Engine as _};
    Ok(format!(
        "data:{};base64,{}",
        mime,
        general_purpose::STANDARD.encode(&data)
    ))
}
