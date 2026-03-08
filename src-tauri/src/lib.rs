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
            copy_resource_to_vault,
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

/// Copie un fichier depuis son chemin absolu vers le vault.
/// Fonctionne pour le drag & drop (fichier sur le disque) et le paste
/// (fichier écrit dans appDataDir/lueurs-tmp par plugin-fs).
/// Après la copie, supprime le fichier source dans un thread séparé
/// si celui-ci vient du dossier temporaire — sans bloquer l'UI.
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
        // Même si le fichier existe déjà, on nettoie le tmp en arrière-plan
        maybe_cleanup_tmp(src_path);
        return Ok(dest.to_string_lossy().to_string());
    }

    std::fs::copy(&src_path, &dest).map_err(|e| format!("copy: {}", e))?;

    println!("[copy_resource_to_vault] ✓ copié vers {:?}", dest);

    // Nettoyage du tmp en arrière-plan, sans bloquer le retour à l'UI
    maybe_cleanup_tmp(src_path);

    Ok(dest.to_string_lossy().to_string())
}

/// Supprime le fichier dans un thread séparé si c'est un fichier temporaire.
/// TODO: améliorer la détection des fichiers temporaires, actuellement basée
/// sur la présence de "lueurs-tmp" dans le chemin. Je crois que de toute façon
/// tous les fichiers sont temporaires...
fn maybe_cleanup_tmp(path: String) {
    if !path.contains("lueurs-tmp") {
        return;
    }
    std::thread::spawn(move || match std::fs::remove_file(&path) {
        Ok(_) => println!("[cleanup_tmp] ✓ supprimé : {}", path),
        Err(e) => println!("[cleanup_tmp] ⚠ échec : {} — {}", path, e),
    });
}
