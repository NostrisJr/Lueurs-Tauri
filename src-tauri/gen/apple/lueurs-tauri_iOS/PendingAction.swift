import Foundation

// Lit et efface l'action en attente déposée par le widget Centre de contrôle.
// Retourne la longueur écrite (> 0), 0 si aucune action, -1 si buffer trop petit.
@_cdecl("pending_action_read_and_clear")
public func pendingActionReadAndClear(
    buffer: UnsafeMutablePointer<CChar>,
    maxLen: Int32
) -> Int32 {
    let defaults = UserDefaults(suiteName: "group.com.md.lueurs")
    guard let action = defaults?.string(forKey: "pendingAction"), !action.isEmpty else {
        return 0
    }
    defaults?.removeObject(forKey: "pendingAction")
    let bytes = action.utf8CString
    guard bytes.count <= Int(maxLen) else { return -1 }
    bytes.withUnsafeBufferPointer { ptr in
        buffer.initialize(from: ptr.baseAddress!, count: bytes.count)
    }
    return Int32(bytes.count)
}
