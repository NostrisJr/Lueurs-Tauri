import AppIntents
import SwiftUI
import WidgetKit

// ── Bundle principal ───────────────────────────────────────────────────────

@main
struct LueursCCBundle: WidgetBundle {
    var body: some Widget {
        RecordingControl()
        NewNoteControl()
    }
}

// ── Bouton Centre de contrôle ──────────────────────────────────────────────

struct RecordingControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.theophiledonato.lueurs.recordingcontrol") {
            ControlWidgetButton(action: StartRecordingIntent()) {
                Label("Enregistrer", systemImage: "mic.fill")
            }
            .tint(.red)
        }
        .displayName("Lueurs")
        .description("Ouvre le dictaphone Lueurs")
    }
}

// Les perform() ci-dessous ne s'exécutent jamais : openAppWhenRun = true
// délègue l'exécution au perform() déclaré dans l'app principale (RecordingIntent.swift).

struct StartRecordingIntent: AppIntent {
    static let title: LocalizedStringResource = "Démarrer un enregistrement Lueurs"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult { .result() }
}

// ── Bouton nouvelle note ───────────────────────────────────────────────────

struct NewNoteControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.theophiledonato.lueurs.newnotecontrol") {
            ControlWidgetButton(action: NewNoteIntent()) {
                Label("Nouvelle note", systemImage: "square.and.pencil")
            }
        }
        .displayName("Lueurs — Note")
        .description("Crée une nouvelle note Lueurs")
    }
}

struct NewNoteIntent: AppIntent {
    static let title: LocalizedStringResource = "Nouvelle note Lueurs"
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult { .result() }
}
