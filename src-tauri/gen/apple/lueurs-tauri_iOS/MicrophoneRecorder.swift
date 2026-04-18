import Foundation
import AVFoundation

// Ce fichier n'est compilé que pour la cible lueurs-tauri_iOS (iOS).
// Le guard os(iOS) supprime les erreurs SourceKit lors de l'analyse macOS.
#if os(iOS)

// ── État global de l'enregistreur ─────────────────────────────────────────
// Accès uniquement depuis les threads Tokio (commandes Tauri) — une session à la fois.
private var _recorder: AVAudioRecorder?
private var _recordingURL: URL?
// 0 = idle, 1 = en cours, -1 = erreur
private var _recStatus: Int32 = 0

// ── Permission microphone ──────────────────────────────────────────────────
// Bloquant (semaphore) — doit être appelé depuis un thread non-principal.
// Retourne : 1 = accordée, 0 = refusée.
@_cdecl("mic_request_permission")
public func micRequestPermission() -> Int32 {
    // Vérification de l'état courant sans déclencher de dialog
    if #available(iOS 17, *) {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:  return 1
        case .denied:   return 0
        default: break  // .undetermined → on demande ci-dessous
        }
    } else {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:  return 1
        case .denied:   return 0
        default: break
        }
    }

    // Permission non encore demandée : affiche le dialog système
    let sem = DispatchSemaphore(value: 0)
    var granted = false
    AVAudioSession.sharedInstance().requestRecordPermission { result in
        granted = result
        sem.signal()
    }
    sem.wait()
    return granted ? 1 : 0
}

// ── Démarrage de l'enregistrement ─────────────────────────────────────────
// Retourne : 0 = OK, -1 = déjà en cours ou erreur session, -2 = erreur recorder
@_cdecl("mic_start_recording")
public func micStartRecording() -> Int32 {
    guard _recorder == nil else { return -1 }

    let session = AVAudioSession.sharedInstance()
    do {
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)
    } catch {
        _recStatus = -1
        return -1
    }

    let timestamp = Int64(Date().timeIntervalSince1970 * 1000)
    let url = FileManager.default.temporaryDirectory
        .appendingPathComponent("lueurs_rec_\(timestamp).m4a")
    _recordingURL = url

    let settings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44100.0,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
    ]

    do {
        let rec = try AVAudioRecorder(url: url, settings: settings)
        guard rec.record() else {
            _recStatus = -1
            return -2
        }
        _recorder = rec
        _recStatus = 1
        return 0
    } catch {
        _recStatus = -1
        return -2
    }
}

// ── Arrêt de l'enregistrement ─────────────────────────────────────────────
// outPath    : buffer pour le chemin absolu du fichier .m4a temporaire
// outPathLen : taille du buffer (4096 suffit)
// outDurationMs : durée enregistrée en millisecondes
// Retourne : 0 = OK, -1 = pas d'enregistrement actif, -2 = buffer trop petit
@_cdecl("mic_stop_recording")
public func micStopRecording(
    outPath: UnsafeMutablePointer<CChar>,
    outPathLen: Int32,
    outDurationMs: UnsafeMutablePointer<Int64>
) -> Int32 {
    guard let rec = _recorder, let url = _recordingURL else {
        return -1
    }

    let durationSec = rec.currentTime
    rec.stop()
    _recorder = nil
    _recStatus = 0

    outDurationMs.pointee = Int64(durationSec * 1000)

    let pathStr = url.path
    let bytes = pathStr.utf8CString
    guard bytes.count <= Int(outPathLen) else {
        _recordingURL = nil
        return -2
    }
    bytes.withUnsafeBufferPointer { ptr in
        outPath.initialize(from: ptr.baseAddress!, count: bytes.count)
    }

    _recordingURL = nil
    // Libère la session pour permettre la lecture audio par d'autres apps
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

    return 0
}

// ── Annulation ────────────────────────────────────────────────────────────
// Stoppe et supprime le fichier temporaire sans le retourner au frontend.
@_cdecl("mic_cancel_recording")
public func micCancelRecording() {
    guard let rec = _recorder else { return }
    rec.stop()
    _recorder = nil
    if let url = _recordingURL {
        try? FileManager.default.removeItem(at: url)
    }
    _recordingURL = nil
    _recStatus = 0
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
}

// ── Statut courant ────────────────────────────────────────────────────────
@_cdecl("mic_get_status")
public func micGetStatus() -> Int32 {
    return _recStatus
}

#endif // os(iOS)
