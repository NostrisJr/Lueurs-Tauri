import Foundation
#if os(iOS)
import UIKit
import WebKit
#endif

/// Résout le chemin du conteneur iCloud ubiquity et le copie dans le buffer fourni par Rust.
/// Doit être appelé depuis un thread non-principal (potentiellement bloquant au premier appel).
///
/// Retourne : nombre d'octets écrits (terminateur null inclus), 0 si iCloud indisponible, -1 si buffer trop petit.
@_cdecl("get_icloud_documents_path")
public func getICloudDocumentsPath(
    buffer: UnsafeMutablePointer<CChar>,
    maxLen: Int32
) -> Int32 {
    // nil = premier container listé dans les entitlements (iCloud.com.md.lueurs)
    guard let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
        return 0
    }

    let docsURL = containerURL.appendingPathComponent("Documents")
    try? FileManager.default.createDirectory(
        at: docsURL,
        withIntermediateDirectories: true,
        attributes: nil
    )

    let bytes = docsURL.path.utf8CString
    guard bytes.count <= Int(maxLen) else { return -1 }

    bytes.withUnsafeBufferPointer { ptr in
        buffer.initialize(from: ptr.baseAddress!, count: bytes.count)
    }
    return Int32(bytes.count)
}

// ── Comportement clavier iOS ───────────────────────────────────────────────
//
// Le clavier passe devant la WebView sans la redimensionner ni la scroller.
// Le JS (useKeyboardHeight / visualViewport) gère le padding de l'éditeur.

// ── Action sheet native iOS ────────────────────────────────────────────────
//
// Présentée depuis un thread Tokio spawn_blocking — DispatchSemaphore.wait()
// bloque ce thread pendant que le main thread anime l'UI, ce qui est correct.

#if os(iOS)

private var _kbWebView: WKWebView?
// Retain l'observation KVO — libéré automatiquement à la deinit du module.
private var _kbScrollObserver: NSKeyValueObservation?

@_cdecl("setup_keyboard_behavior")
public func setupKeyboardBehavior() {
    DispatchQueue.main.async {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            _kbWebView = _findWKWebView()
            guard let sv = _kbWebView?.scrollView else { return }
            // Empêche iOS d'ajouter un contentInset quand le clavier s'ouvre.
            sv.contentInsetAdjustmentBehavior = .never
            // Verrouille l'offset de page à zéro — neutralise aussi les appels
            // programmatiques de WebKit (scrollIntoView sur focus).
            _kbScrollObserver = sv.observe(\.contentOffset, options: [.new]) { scrollView, _ in
                if scrollView.contentOffset != .zero {
                    scrollView.setContentOffset(.zero, animated: false)
                }
            }
        }
    }
}

private func _findWKWebView() -> WKWebView? {
    let windows: [UIWindow]
    if #available(iOS 15, *) {
        windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
    } else {
        windows = UIApplication.shared.windows
    }
    for w in windows {
        if let found = _searchWKWebView(in: w) { return found }
    }
    return nil
}

private func _searchWKWebView(in view: UIView) -> WKWebView? {
    if let wv = view as? WKWebView { return wv }
    for sub in view.subviews {
        if let found = _searchWKWebView(in: sub) { return found }
    }
    return nil
}

// ── Action sheet ──────────────────────────────────────────────────────────
//
// json : {"title":"…","actions":["Renommer","Supprimer",…]}
// Retourne l'index sélectionné, ou -1 si annulé / erreur.

@_cdecl("show_ios_action_sheet")
public func showIosActionSheet(
    jsonPtr: UnsafePointer<CChar>,
    result: UnsafeMutablePointer<Int32>
) {
    struct Payload: Decodable {
        let title: String?
        let actions: [String]
    }

    guard let jsonStr = String(cString: jsonPtr, encoding: .utf8),
          let data = jsonStr.data(using: .utf8),
          let payload = try? JSONDecoder().decode(Payload.self, from: data)
    else {
        result.pointee = -1
        return
    }

    let semaphore = DispatchSemaphore(value: 0)

    DispatchQueue.main.async {
        let alert = UIAlertController(title: payload.title, message: nil, preferredStyle: .actionSheet)

        for (i, title) in payload.actions.enumerated() {
            let idx = i
            let style: UIAlertAction.Style = title.lowercased().contains("supprimer") ? .destructive : .default
            alert.addAction(UIAlertAction(title: title, style: style) { _ in
                result.pointee = Int32(idx)
                semaphore.signal()
            })
        }
        alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in
            result.pointee = -1
            semaphore.signal()
        })

        guard let topVC = _topViewController() else {
            result.pointee = -1
            semaphore.signal()
            return
        }
        topVC.present(alert, animated: true)
    }

    semaphore.wait()
}

// ── Prompt de renommage ────────────────────────────────────────────────────
//
// json : {"title":"…","placeholder":"…","current":"…"}
// Écrit le nouveau nom dans resultBuffer (UTF-8, terminé par NUL).
// Retourne la longueur écrite (0 = annulé).

@_cdecl("show_ios_rename_prompt")
public func showIosRenamePrompt(
    jsonPtr: UnsafePointer<CChar>,
    resultBuffer: UnsafeMutablePointer<CChar>,
    maxLen: Int32
) -> Int32 {
    struct Payload: Decodable {
        let title: String?
        let placeholder: String?
        let current: String?
    }

    guard let jsonStr = String(cString: jsonPtr, encoding: .utf8),
          let data = jsonStr.data(using: .utf8),
          let payload = try? JSONDecoder().decode(Payload.self, from: data)
    else {
        return 0
    }

    let semaphore = DispatchSemaphore(value: 0)
    var newName: String = ""

    DispatchQueue.main.async {
        let alert = UIAlertController(
            title: payload.title ?? "Renommer",
            message: nil,
            preferredStyle: .alert
        )
        alert.addTextField { tf in
            tf.text = payload.current
            tf.placeholder = payload.placeholder
            tf.clearButtonMode = .whileEditing
            tf.returnKeyType = .done
            tf.autocorrectionType = .no
        }
        alert.addAction(UIAlertAction(title: "Renommer", style: .default) { _ in
            newName = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespaces) ?? ""
            semaphore.signal()
        })
        alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in
            semaphore.signal()
        })

        guard let topVC = _topViewController() else {
            semaphore.signal()
            return
        }
        topVC.present(alert, animated: true) {
            // Sélectionner tout le texte existant après animation
            alert.textFields?.first?.selectAll(nil)
        }
    }

    semaphore.wait()

    guard !newName.isEmpty else { return 0 }
    let bytes = newName.utf8CString
    guard bytes.count <= Int(maxLen) else { return 0 }
    bytes.withUnsafeBufferPointer { ptr in
        resultBuffer.initialize(from: ptr.baseAddress!, count: bytes.count)
    }
    return Int32(bytes.count)
}

// ── Helpers UI ─────────────────────────────────────────────────────────────

private func _topViewController() -> UIViewController? {
    let windows: [UIWindow]
    if #available(iOS 15, *) {
        windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
    } else {
        windows = UIApplication.shared.windows
    }
    guard let root = windows.first?.rootViewController else { return nil }
    var top = root
    while let presented = top.presentedViewController { top = presented }
    return top
}

#endif // os(iOS)
