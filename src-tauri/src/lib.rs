use tauri_plugin_fs::FsExt;

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
            copy_resource_to_vault
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn allow_vault_path(app: tauri::AppHandle, vault_path: String) -> Result<(), String> {
    println!("[allow_vault_path] vault_path = {:?}", vault_path);
    let path = std::path::PathBuf::from(&vault_path);
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    println!("[allow_vault_path] ✓ scope autorisé");
    Ok(())
}

/// Copie un fichier depuis son emplacement source (ex: Desktop, Downloads)
/// vers le vault iCloud. Rust n'est pas soumis au scope fs frontend.
/// Si le fichier existe déjà (même nom = même hash), ne recopie pas.
#[tauri::command]
async fn copy_resource_to_vault(
    src_path: String,
    vault_path: String,
    sub_dir: String,
    filename: String,
) -> Result<String, String> {
    println!(
        "[copy_resource_to_vault] {} -> {}/{}/{}",
        src_path, vault_path, sub_dir, filename
    );

    let dest_dir = std::path::PathBuf::from(&vault_path)
        .join("resources")
        .join(&sub_dir);

    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("create_dir_all: {}", e))?;

    let dest = dest_dir.join(&filename);

    if dest.exists() {
        println!("[copy_resource_to_vault] déjà présent, réutilisation");
        return Ok(dest.to_string_lossy().to_string());
    }

    std::fs::copy(&src_path, &dest).map_err(|e| format!("copy: {}", e))?;

    println!("[copy_resource_to_vault] ✓ copié vers {:?}", dest);
    Ok(dest.to_string_lossy().to_string())
}
