// Export PDF / aperçu SVG via Typst embarqué.
//
// Architecture aperçu :
// - Thread dédié "typst-compiler" avec boîte aux lettres (Mutex + Condvar).
//   Si une nouvelle requête arrive pendant une compilation, elle remplace
//   la requête en attente → seule la dernière option choisie est compilée.
// - Pages émises via événements Tauri au fil du rendu : la page 1 apparaît
//   dès qu'elle est prête, sans attendre les pages suivantes.
// - World singleton dans le thread : pas de Mutex de compilation, comemo
//   réutilise les calculs inter-requêtes via Source::replace().
//
// Export PDF : spawn_blocking séparé (action explicite, latence acceptable).

use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex, OnceLock};

use base64::Engine;
use serde::Serialize;
use tauri::Emitter;
use typst::{
    Library, LibraryExt, World,
    diag::{FileError, FileResult},
    foundations::{Bytes, Datetime, Duration},
    syntax::{FileId, Source},
    text::{Font, FontBook},
    utils::LazyHash,
};
use typst_layout::PagedDocument;
use typst_pdf::PdfOptions;
use typst_svg::SvgOptions;

// ── Polices ───────────────────────────────────────────────────────────────────

const POLICES_EMBARQUEES: &[&[u8]] = &[
    include_bytes!("../fonts/InterVariable.ttf"),
    include_bytes!("../fonts/InterVariable-Italic.ttf"),
    include_bytes!("../fonts/EBGaramond-VariableFont_wght.ttf"),
    include_bytes!("../fonts/EBGaramond-Italic-VariableFont_wght.ttf"),
];

static POLICES: OnceLock<Vec<Font>> = OnceLock::new();
static LIVRE: OnceLock<Arc<LazyHash<FontBook>>> = OnceLock::new();
static LIBRAIRIE: OnceLock<Arc<LazyHash<Library>>> = OnceLock::new();

fn charger_polices() -> &'static Vec<Font> {
    POLICES.get_or_init(|| {
        let mut fonts: Vec<Font> = Vec::new();
        for data in typst_assets::fonts() {
            let bytes = Bytes::new(data);
            for index in 0u32.. {
                match Font::new(bytes.clone(), index) {
                    Some(font) => fonts.push(font),
                    None => break,
                }
            }
        }
        for data in POLICES_EMBARQUEES {
            let bytes = Bytes::new(*data);
            for index in 0u32.. {
                match Font::new(bytes.clone(), index) {
                    Some(font) => fonts.push(font),
                    None => break,
                }
            }
        }
        fonts
    })
}

fn livre_polices() -> Arc<LazyHash<FontBook>> {
    LIVRE.get_or_init(|| Arc::new(LazyHash::new(FontBook::from_fonts(charger_polices()))))
        .clone()
}

fn librairie() -> Arc<LazyHash<Library>> {
    LIBRAIRIE
        .get_or_init(|| Arc::new(LazyHash::new(Library::builder().build())))
        .clone()
}

// ── World ─────────────────────────────────────────────────────────────────────

struct LueursWorld {
    library: Arc<LazyHash<Library>>,
    book: Arc<LazyHash<FontBook>>,
    source: Source,
}

impl LueursWorld {
    fn creer() -> Self {
        Self {
            library: librairie(),
            book: livre_polices(),
            source: Source::detached(String::new()),
        }
    }

    fn mettre_a_jour(&mut self, contenu: &str) {
        self.source.replace(contenu);
    }
}

impl World for LueursWorld {
    fn library(&self) -> &LazyHash<Library> { &self.library }
    fn book(&self) -> &LazyHash<FontBook> { &self.book }
    fn main(&self) -> FileId { self.source.id() }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.source.id() {
            Ok(self.source.clone())
        } else {
            Err(FileError::NotFound(PathBuf::new()))
        }
    }

    fn file(&self, _id: FileId) -> FileResult<Bytes> {
        Err(FileError::NotFound(PathBuf::new()))
    }

    fn font(&self, index: usize) -> Option<Font> {
        charger_polices().get(index).cloned()
    }

    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> { None }
}

// ── Thread dédié aperçu ───────────────────────────────────────────────────────

struct DemandeApercu {
    contenu: String,
    request_id: u64,
    app: tauri::AppHandle,
}

#[derive(Serialize, Clone)]
struct ApercuPage {
    request_id: u64,
    page_idx: usize,
    total: usize,
    svg: String,
}

#[derive(Serialize, Clone)]
struct ApercuErreur {
    request_id: u64,
    message: String,
}

// Boîte aux lettres : la dernière demande remplace la précédente si le thread
// est occupé. Seule la requête la plus récente sera compilée.
static BOITE: OnceLock<(Mutex<Option<DemandeApercu>>, Condvar)> = OnceLock::new();
// Cache SVG : (hash source → SVGs base64 par page).
static CACHE_SVG: OnceLock<Mutex<Option<(u64, Vec<String>)>>> = OnceLock::new();

fn boite() -> &'static (Mutex<Option<DemandeApercu>>, Condvar) {
    BOITE.get_or_init(|| (Mutex::new(None), Condvar::new()))
}

fn cache_svg() -> &'static Mutex<Option<(u64, Vec<String>)>> {
    CACHE_SVG.get_or_init(|| Mutex::new(None))
}

fn hacher(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}

fn thread_compilation() {
    let mut world = LueursWorld::creer();
    let (lock, cvar) = boite();

    loop {
        // Attendre une demande
        let demande = {
            let mut guard = lock.lock().unwrap();
            while guard.is_none() {
                guard = cvar.wait(guard).unwrap();
            }
            guard.take().unwrap()
        };

        let hash = hacher(&demande.contenu);

        // Cache hit : émettre les SVGs directement, sans recompiler
        {
            let cache = cache_svg().lock().unwrap();
            if let Some((h, ref svgs)) = *cache {
                if h == hash {
                    let total = svgs.len();
                    for (i, svg) in svgs.iter().enumerate() {
                        let _ = demande.app.emit("apercu_page", ApercuPage {
                            request_id: demande.request_id,
                            page_idx: i,
                            total,
                            svg: svg.clone(),
                        });
                    }
                    continue;
                }
            }
        }

        world.mettre_a_jour(&demande.contenu);
        let warned = typst::compile::<PagedDocument>(&world);
        comemo::evict(30);

        let document = match warned.output {
            Ok(doc) => doc,
            Err(errs) => {
                let msg = errs.into_iter()
                    .map(|e| e.message.to_string())
                    .collect::<Vec<_>>()
                    .join("\n");
                let _ = demande.app.emit("apercu_erreur", ApercuErreur {
                    request_id: demande.request_id,
                    message: msg,
                });
                continue;
            }
        };

        let pages = document.pages();
        let total = pages.len();
        let mut cache = Vec::with_capacity(total);

        for (i, page) in pages.iter().enumerate() {
            let svg = typst_svg::svg(page, &SvgOptions::default());
            let b64 = base64::engine::general_purpose::STANDARD.encode(svg.as_bytes());
            let _ = demande.app.emit("apercu_page", ApercuPage {
                request_id: demande.request_id,
                page_idx: i,
                total,
                svg: b64.clone(),
            });
            cache.push(b64);
        }

        *cache_svg().lock().unwrap() = Some((hash, cache));
    }
}

// ── API publique ──────────────────────────────────────────────────────────────

/// Initialise polices, World et démarre le thread de compilation.
/// À appeler au démarrage dans un thread de fond.
pub fn prechauffer() {
    charger_polices();
    livre_polices();
    librairie();
    boite(); // initialise la boîte aux lettres
    std::thread::Builder::new()
        .name("typst-compiler".into())
        .spawn(thread_compilation)
        .expect("impossible de démarrer le thread typst-compiler");
}

/// Envoie une demande d'aperçu au thread dédié (retour immédiat).
/// Les pages arrivent via les événements "apercu_page" / "apercu_erreur".
#[tauri::command]
pub async fn compiler_typst_apercu(
    contenu_typst: String,
    request_id: u64,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let (lock, cvar) = boite();
    *lock.lock().unwrap() = Some(DemandeApercu {
        contenu: contenu_typst,
        request_id,
        app,
    });
    cvar.notify_one();
    Ok(())
}

#[tauri::command]
pub async fn exporter_pdf(contenu_typst: String, chemin_dest: String) -> Result<(), String> {
    let bytes = tokio::task::spawn_blocking(move || {
        let mut world = LueursWorld::creer();
        world.mettre_a_jour(&contenu_typst);
        let warned = typst::compile::<PagedDocument>(&world);
        comemo::evict(30);
        let document = warned.output.map_err(|errs| {
            errs.into_iter().map(|e| e.message.to_string()).collect::<Vec<_>>().join("\n")
        })?;
        typst_pdf::pdf(&document, &PdfOptions::default()).map_err(|errs| {
            errs.into_iter().map(|e| e.message.to_string()).collect::<Vec<_>>().join("\n")
        })
    })
    .await
    .map_err(|e| e.to_string())??;
    tokio::fs::write(&chemin_dest, &bytes).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn exporter_typst(contenu_typst: String, chemin_dest: String) -> Result<(), String> {
    tokio::fs::write(&chemin_dest, contenu_typst.as_bytes())
        .await
        .map_err(|e| e.to_string())
}
