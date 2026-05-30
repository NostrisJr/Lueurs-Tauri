//! Arrondi personnalisé des coins de la fenêtre macOS, plus grand que le rayon natif.
//! On clippe le `contentView` de la NSWindow pour que le webview (WKWebView) suive
//! le même arrondi que la vue de vibrancy ; sinon le webview garde le rayon système
//! (plus petit) et masque l'arrondi de la vibrancy.

use cocoa::base::{id, YES};
use objc::{msg_send, sel, sel_impl};

/// Rayon des coins, partagé entre la vibrancy et le clip du contentView.
/// la valeur a été décidée à l'oeil
pub const CORNER_RADIUS: f64 = 26.0;

/// Pose `cornerRadius` + `masksToBounds` sur le layer du contentView.
/// Les traffic lights vivent dans la frame view (sœur du contentView), donc non clippées.
pub fn apply_corner_radius(window: &tauri::WebviewWindow, radius: f64) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
    unsafe {
        let content_view: id = msg_send![ns_window, contentView];
        let _: () = msg_send![content_view, setWantsLayer: YES];
        let layer: id = msg_send![content_view, layer];
        if layer.is_null() {
            return Err("contentView sans layer".into());
        }
        let _: () = msg_send![layer, setCornerRadius: radius];
        let _: () = msg_send![layer, setMasksToBounds: YES];
    }
    Ok(())
}
