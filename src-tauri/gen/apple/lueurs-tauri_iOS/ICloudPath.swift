import Foundation

/// Résout le chemin du conteneur iCloud ubiquity et le copie dans le buffer fourni par Rust.
/// Doit être appelé depuis un thread non-principal (potentiellement bloquant au premier appel).
///
/// Retourne : nombre d'octets écrits (terminateur null inclus), 0 si iCloud indisponible, -1 si buffer trop petit.
@_cdecl("get_icloud_documents_path")
public func getICloudDocumentsPath(
    buffer: UnsafeMutablePointer<CChar>,
    maxLen: Int32
) -> Int32 {
    // nil = premier container listé dans les entitlements (iCloud.com.theophiledonato.lueurs)
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
