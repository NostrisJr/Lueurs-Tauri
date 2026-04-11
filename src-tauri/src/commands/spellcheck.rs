use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Debug, Serialize, Deserialize)]
pub struct SpellError {
    pub from: usize,
    pub to: usize,
    pub message: String,
    pub suggestions: Vec<String>,
    pub rule_id: String,
    pub is_spelling: bool,
}

// ── Résolution du chemin sidecar ──────────────────────────────────────────────

/// En développement : src-tauri/binaries/grammalecte-sidecar-<triple>
/// En production (macOS) : <AppName>.app/Contents/MacOS/grammalecte-sidecar
fn sidecar_path() -> Result<PathBuf, String> {
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };

    if cfg!(debug_assertions) {
        // CARGO_MANIFEST_DIR pointe vers src-tauri/
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            // TAURI_ENV_TARGET_TRIPLE est injecté par le build script de Tauri
            .join(format!("grammalecte-sidecar-{}{}", env!("TAURI_ENV_TARGET_TRIPLE"), ext));

        if path.exists() {
            return Ok(path);
        }
        return Err(format!(
            "Sidecar introuvable (dev) : {}. Compile-le avec ./build-sidecar.sh",
            path.display()
        ));
    }

    // Production : à côté de l'exécutable principal
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe.parent().ok_or("Répertoire de l'exécutable introuvable")?;
    Ok(exe_dir.join(format!("grammalecte-sidecar{}", ext)))
}

// ── Commande Tauri ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_grammar(text: String) -> Result<Vec<SpellError>, String> {
    if text.trim().is_empty() {
        return Ok(vec![]);
    }

    let path = sidecar_path()?;

    let mut child = Command::new(&path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Impossible de lancer le sidecar ({}) : {}", path.display(), e))?;

    // Écrire le texte ; drop de stdin → EOF pour le sidecar Python
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Erreur stdin : {e}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Erreur wait : {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_grammalecte_output(&stdout, &text)
}

// ── Parsing JSON ──────────────────────────────────────────────────────────────

fn parse_grammalecte_output(json: &str, original: &str) -> Result<Vec<SpellError>, String> {
    let v: serde_json::Value =
        serde_json::from_str(json.trim()).map_err(|e| format!("JSON invalide : {e}\n{json}"))?;

    let data = v["data"]
        .as_array()
        .ok_or_else(|| "Champ 'data' manquant dans la réponse Grammalecte".to_string())?;

    // Offsets de début de chaque paragraphe (split par \n)
    let paragraphs: Vec<&str> = original.split('\n').collect();
    let mut para_offsets: Vec<usize> = Vec::with_capacity(paragraphs.len());
    let mut acc = 0usize;
    for p in &paragraphs {
        para_offsets.push(acc);
        acc += p.len() + 1; // +1 pour le \n
    }

    let mut errors = Vec::new();

    for para_data in data {
        // iParagraph est 1-indexé
        let i_para = para_data["iParagraph"].as_u64().unwrap_or(1) as usize;
        let para_offset = para_offsets.get(i_para.saturating_sub(1)).copied().unwrap_or(0);

        // Erreurs grammaticales
        if let Some(grammar_errors) = para_data["lGrammarErrors"].as_array() {
            for err in grammar_errors {
                let from = err["nStart"].as_u64().unwrap_or(0) as usize + para_offset;
                let to = err["nEnd"].as_u64().unwrap_or(0) as usize + para_offset;
                if from >= to {
                    continue;
                }
                errors.push(SpellError {
                    from,
                    to,
                    message: err["sMessage"].as_str().unwrap_or("").to_string(),
                    suggestions: extract_suggestions(&err["aSuggestions"]),
                    rule_id: err["sRuleId"].as_str().unwrap_or("").to_string(),
                    is_spelling: false,
                });
            }
        }

        // Erreurs orthographiques (lSpellingErrors, pas lSpellErrors)
        if let Some(spell_errors) = para_data["lSpellingErrors"].as_array() {
            for err in spell_errors {
                let from = err["nStart"].as_u64().unwrap_or(0) as usize + para_offset;
                let to = err["nEnd"].as_u64().unwrap_or(0) as usize + para_offset;
                if from >= to {
                    continue;
                }
                let word = err["sValue"].as_str().unwrap_or("").to_string();
                errors.push(SpellError {
                    from,
                    to,
                    message: format!("Mot inconnu : {}", word),
                    suggestions: extract_suggestions(&err["aSuggestions"]),
                    rule_id: "spell".to_string(),
                    is_spelling: true,
                });
            }
        }
    }

    Ok(errors)
}

fn extract_suggestions(value: &serde_json::Value) -> Vec<String> {
    value
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|s| s.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}
