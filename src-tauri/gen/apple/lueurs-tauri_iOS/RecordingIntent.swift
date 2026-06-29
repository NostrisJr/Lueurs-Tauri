import AppIntents
import Foundation

// Déclaré ici (app principale) pour que iOS sache quelle app ouvrir au tap du
// bouton Centre de contrôle. Le système rapproche ce type de celui de l'extension
// par le nom ; c'est le perform() de ce fichier qui est appelé (dans le process
// de l'app), pas celui de l'extension.
struct StartRecordingIntent: AppIntent {
    static let title: LocalizedStringResource = "Démarrer un enregistrement Lueurs"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.md.lueurs")
        defaults?.set("recording", forKey: "pendingAction")
        return .result()
    }
}

struct NewNoteIntent: AppIntent {
    static let title: LocalizedStringResource = "Nouvelle note Lueurs"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.md.lueurs")
        defaults?.set("new-note", forKey: "pendingAction")
        return .result()
    }
}
