fn main() {
    // Sur iOS, le symbole Swift get_icloud_documents_path est compilé par Xcode
    // après Cargo — le linker cdylib le verra au link final Xcode, pas ici.
    // -U autorise le symbole indéfini dans la cdylib sans erreur.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        println!("cargo:rustc-link-arg-cdylib=-Wl,-U,_get_icloud_documents_path");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-U,_setup_keyboard_behavior");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-U,_show_ios_action_sheet");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-U,_show_ios_rename_prompt");
    }

    tauri_build::build()
}
