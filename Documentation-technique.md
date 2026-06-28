# Lueurs — Documentation technique

## Architecture générale

Lueurs est une application desktop construite avec **Tauri 2** (Rust + WKWebView) et **React** côté frontend. Les notes sont des fichiers `.md` stockés dans un dossier vault choisi par l'utilisateur. Toute la persistance est locale : pas de serveur, pas de base de données.

### État global (Jotai)

L'état de l'application est géré par des atomes Jotai (`src/lib/atoms.ts`) :

- `treeAtom` — l'arbre complet du vault (source de vérité pour les données des notes)
- `activeNoteIdAtom` — chemin de la note active (= onglet actif)
- `openTabIdsAtom` — liste ordonnée des chemins des onglets ouverts
- `activeNoteAtom` — atome dérivé : note courante extraite du tree
- `folderPathAtom` — chemin du vault (persisté en localStorage)

### Flux de données

```
Vault (disque) → useFileTree → treeAtom → activeNoteAtom → Éditeur
      ↑                                                         |
      └──── FS watcher (débounce 500 ms) ←── Rust update_note ─┘
```

Les modifications sont appliquées immédiatement en mémoire (mise à jour optimiste de `treeAtom`), puis envoyées à Rust via `invoke("update_note")`. Rust écrit le fichier sur le disque et émet l'événement `vault:patch`. `useVaultSync` écoute cet événement et réconcilie `treeAtom` avec les données Rust. Un registre `writingPathsRegistry` (Set module-level dans `vaultIO.ts`) liste les chemins en cours d'écriture : le watcher FS ignore ces chemins pour éviter de traiter ses propres modifications.

### Commandes Tauri (src-tauri/src/lib.rs)

| Commande | Description |
|---|---|
| `allow_vault_path(vault_path)` | Enregistre le vault dans le FS scope Tauri |
| `copy_resource_to_vault(src, vault, sub_dir, filename)` | Copie un média dans `resources/` |
| `propagate_template_change(affected_paths, change)` | Propagation batch de frontmatter en parallèle (Tokio) |
| `update_note(id, raw_content)` | Écrit une note sur le disque et émet `vault:patch` |
| `get_titlebar_height(window)` | Hauteur physique de la titlebar macOS (`inner_position.y - outer_position.y`) |
| `get_scale_factor(window)` | DPR de la fenêtre (identique à `window.devicePixelRatio`) |
| `get_icloud_path()` | Retourne le chemin du container iCloud (iOS et macOS) |
| `open_import_picker()` | NSOpenPanel macOS (fichiers + dossiers), appelable depuis JS via `run_on_main_thread` + canal oneshot |

---

## Navigation multi-onglets

### État

`activeNoteIdAtom` reste la source de vérité de l'onglet actif. `openTabIdsAtom` est un `atom<string[]>` contenant les chemins des onglets ouverts dans l'ordre d'affichage. Le composant éditeur garde `key={activeNote.id}` : il se remonte à chaque changement d'onglet, ce qui réinitialise l'historique ProseMirror. Ce comportement est intentionnel — la complexité de préserver les états ProseMirror par onglet ne justifie pas le gain.

### Logique d'ouverture (`useNote.handleSelectNote`)

Un clic simple remplace l'onglet actif dans `openTabIds` (`map` sur l'id actif). Cmd+clic ajoute la note en fin de liste si absente. Dans les deux cas, si la note est déjà dans `openTabIds`, seul `activeNoteIdAtom` est mis à jour. Cette logique garantit qu'une note n'apparaît jamais deux fois dans la barre.

### Fermeture (`handleCloseTab`)

```ts
const idx = openTabIds.indexOf(id);
const newActive = openTabIds[idx - 1] ?? openTabIds[idx + 1] ?? null;
```

La suppression (`handleDeleteNote`, `handleDeleteFolder`) et le renommage (`handleRename`) maintiennent `openTabIds` en cohérence : les paths sont retirés ou remplacés selon l'opération.

### TabBar (`src/components/TabBar/TabBar.tsx`)

Implémenté avec `@dnd-kit/sortable` (`horizontalListSortingStrategy`) pour le réordonnement par drag & drop. Points techniques :

- **Hooks-before-return** : tous les hooks (`useSensors`, `useCallback`, etc.) sont déclarés avant le `if (openTabIds.length === 0) return null` pour respecter les règles React. Ne jamais mettre de retour conditionnel avant un appel de hook.
- **Pattern DragOverlay** : pendant le drag, l'onglet original est rendu avec `visibility: hidden` (prop `isGhost`) pour conserver son espace dans le layout. Un `DragOverlay` flotte séparément avec l'apparence finale, évitant les changements de taille causés par la translation @dnd-kit.
- **Filtrage avant render** : les tabs sont filtrés (`filter((item): item is ...`) avant de mapper pour éviter un nombre variable d'appels à `useSortable` (violation des règles de hooks).

### Hook `useCmdHeld`

`src/hooks/useCmdHeld.ts` expose un booléen indiquant si la touche Cmd (Meta) est enfoncée. Écoute `keydown`/`keyup` sur `window` avec cleanup dans `useEffect`. Utilisé dans `NoteChip`, `KanbanCard`, et `TableRow` pour conditionner le curseur et le comportement au clic.

### KanbanCard : édition inline + drag & drop

`useSortable` place ses listeners sur le conteneur de la carte. Pour que le double-clic sur le titre déclenche l'édition sans interférer avec le drag :

- `onDoubleClick` appelle `e.stopPropagation()` avant de passer en mode édition
- Le `<input>` d'édition a un `onClick` avec `e.stopPropagation()` pour empêcher les clicks de remonter aux listeners dnd-kit
- `onKeyDown` avec `e.stopPropagation()` sur l'input empêche les touches (notamment Escape) d'être capturées par @dnd-kit

---

## Fichiers médias dans le vault

### Nouveau variant `MediaFile` dans `TreeNode`

`TreeNode = NoteFile | FolderNode | MediaFile`. `MediaFile` contient `id` (chemin absolu), `name` (sans extension), `fileName` (avec extension) et `mediaType: "image" | "audio" | "video" | "pdf"`.

`loadTree` (`vaultIO.ts`) reconnaît maintenant les extensions médias via la table `MEDIA_EXTENSIONS` et crée des nœuds `MediaFile`. Les médias sont triés après les notes dans `sortNodes` (ordre : dossiers → notes → médias).

`flattenTree` ne retourne que des `NoteFile` (comportement inchangé). Pour les médias, `mediaByIdAtom` les indexe par ID en traversant le tree indépendamment.

### Atoms

- `mediaByIdAtom` — `Map<string, MediaFile>` recalculée à chaque changement de `treeAtom`.
- `activeMediaAtom` — dérivé : retourne le `MediaFile` dont l'ID correspond à `activeNoteIdAtom`, ou `null`.
- `selectedIdsAtom` — `Set<string>` pour la multi-sélection du file tree (notes + médias + dossiers).
- `selectionAnchorAtom` — `string | null`, dernier item cliqué sans Maj (ancre de plage).

### Routing dans `DesktopApp`

```
activeNoteAtom (NoteFile)  → NoteEditor
activeMediaAtom (MediaFile) → MediaViewer
aucun                       → écran vide
```

`activeNoteAtom` reste `NoteFile | null` (non modifié). Cliquer un `MediaFile` dans le file tree appelle `setActiveNoteId(node.id)` directement, sans passer par `handleSelectNote` (qui est spécifique aux `.md`).

### StandaloneAudioPlayer

`src/desktop/components/MediaViewer/StandaloneAudioPlayer.tsx` — version sans couplage ProseMirror d'`AudioBlockComponent`. Partage `drawWaveform` (waveform.ts) et les fonctions `nativeAudioPlayer` pour la cohérence visuelle et comportementale. Lit le fichier via `readFile` du plugin FS plutôt que via `readAudioData` de la config du plugin (le chemin est absolu dans ce contexte).

---

## Drag & Drop interne (réorganisation du vault)

### Pourquoi pointer events et non HTML5 DnD

Sur macOS, Tauri/WKWebView intercepte tous les événements de drag au niveau OS via `WKDragDestinationAction`. Conséquences :

- Les événements DOM `dragover` et `drop` ne fire **jamais** sur les éléments HTML pendant un drag interne
- `mousemove` est supprimé par WebKit pendant un drag HTML5
- `onDragDropEvent` Tauri fire `"enter"` et `"leave"` mais pas `"over"` de manière fiable pour les drags internes
- L'event HTML5 `drag` ne fire qu'1-2 fois par session (pas continu)

Les **pointer events** (`pointermove`) sont des événements DOM purs que WebKit fire normalement — Tauri ne les intercepte pas. Les coordonnées `clientX/Y` sont en pixels CSS relatifs au viewport, directement utilisables avec `document.elementFromPoint`.

### Implémentation (`src/hooks/useFileDrop.ts`)

- `onPointerDown` sur chaque nœud de l'arbre : enregistre la source, monte des listeners `pointermove` / `pointerup` / `pointercancel` sur `window` en phase de capture
- Seuil de 5px avant déclenchement du drag (évite les glissements accidentels au clic)
- Un ghost element (div fixed, `pointer-events: none`, offset +14/-10px du curseur) fournit le retour visuel sans couvrir la dropzone détectée par `elementFromPoint`
- `pointermove` détecte la dropzone via `elementFromPoint(clientX, clientY)` et met à jour `dragOverAtom`
- `pointerup` exécute le déplacement si une dropzone valide est présente ; `Échap` annule
- Les refs stables (`moveNodeRef`, `propagateNoteRenameRef`, etc.) garantissent que les callbacks dans les closures sont toujours à jour sans recréer les listeners

### `vaultIO.move` — déplacement cross-dossier

`vaultIO.rename(uri, newName)` ne change que le dernier segment du chemin (renommage dans le même dossier). Pour déplacer un fichier vers un autre dossier, `vaultIO.move(sourceUri, destUri)` appelle directement `rename(source, dest)` du plugin FS avec le chemin de destination complet. `moveNode` utilise `move()` au lieu de `rename()` depuis cette correction.

La détection `isFolder` dans `moveNode` utilise `!(/\.[^/]+$/.test(sourceName))` (absence d'extension) pour distinguer un dossier d'un fichier média — l'ancienne logique `!endsWith(".md")` traitait les médias comme des dossiers.

### Multi-sélection et déplacement groupé

**Sélection par plage.** Chaque ligne du file tree porte `data-node-id`. Au Maj+Clic, `computeRangeSelection(anchor, target, tree)` interroge le DOM (`querySelectorAll("[data-node-id]")`) pour obtenir l'ordre visuel, extrait les IDs entre les deux indices, puis étend les dossiers de la plage en ajoutant récursivement leurs descendants depuis `treeAtom` (`collectDescendantIds`). Les dossiers fermés voient leurs enfants inclus même s'ils ne sont pas dans le DOM.

**Drag multi-sélection.** Si l'item draggé est dans `selectedIdsAtom`, `onPointerDown` construit `dragIds = [...selectedIds]` ; sinon `dragIds = [sourceId]`. Le ghost affiche `"N éléments"`. `handleInternalDrop` boucle sur `dragIds` en séquentiel (évite les conflits d'arbre concurrent) et appelle `moveNode` + propagation pour chaque ID.

### Propagation après déplacement

`handleInternalDrop` appelle `moveNode` (déplacement FS), puis `propagateFolderRename` ou `propagateNoteRename` pour mettre à jour toutes les références dans le vault. Les médias n'ont pas de références frontmatter — aucune propagation n'est déclenchée pour eux. Si la note active fait partie du sous-arbre déplacé, `activeNoteIdAtom` est mis à jour avec le nouveau chemin.

---

## Import de fichiers et dossiers

### `importUtils.ts` — source de vérité partagée

Trois points d'entrée dans l'app déclenchent un import : le drag & drop depuis le Finder, le menu Fichier macOS, et le menu contextuel. Tous passent par les mêmes fonctions dans `src/shared/lib/importUtils.ts` :

- `importMdFile(srcPath, destFolder)` — lit, injecte `__Type__`, résout les conflits de nom, écrit.
- `importMediaFile(srcPath, destFolder, fileName)` — copie byte-à-byte, résout les conflits de nom.
- `importFolderRecursive(srcPath, destParentPath, folderName)` — crée le dossier via `vaultIO.createDir`, cherche une `FolderName.md` existante dans la source (la réutilise si présente pour préserver le contenu), puis itère récursivement sur `.md`, médias et sous-dossiers.
- `importPaths(targetFolderPath, paths[])` — dispatch par type, catch par chemin.

### NSOpenPanel macOS — picker fichiers + dossiers

Le picker natif `NSOpenPanel` avec `canChooseFiles = YES` et `canChooseDirectories = YES` permet de sélectionner à la fois des fichiers et des dossiers dans une seule boîte de dialogue, ce que l'API `@tauri-apps/plugin-dialog` ne peut pas faire (elle distingue fichiers ou dossiers).

Deux points d'appel :

1. **Depuis `on_menu_event` (menu bar)** — le callback est déjà sur le thread principal macOS. `open_import_picker_macos()` appelle `[NSOpenPanel runModal]` de façon synchrone (NSPanel gère son propre run loop) et retourne les chemins. Si non vide, `app.emit("menu:import-files", paths)`.

2. **Depuis JavaScript (menu contextuel)** — commande `open_import_picker(AppHandle)` : `app.run_on_main_thread(|| { … tx.send(paths) })` + `rx.await`. Le canal `tokio::sync::oneshot` permet à la commande async de bloquer proprement en attendant la réponse du thread principal.

### Mobile — dialog picker

Sur iOS/Android, l'import passe par `open({ multiple: true })` de `@tauri-apps/plugin-dialog` qui affiche le sélecteur de documents natif (Files/SAF). Les chemins retournés sont traités par `importPaths`. Sur Android, les URI SAF ne sont pas toujours lisibles avec `readTextFile({ baseDir: null })` — les échecs sont loggués silencieusement par item.

## Drag & Drop externe (import depuis Finder)

### Problème : coordonnées wry incorrectes sur macOS

Tauri/wry intercepte les drags Finder via les méthodes Objective-C `draggingEntered:`, `draggingUpdated:`, `performDragOperation:`. Lors du drop, le payload `position` est fourni, mais en **pixels physiques relatifs au frame fenêtre macOS** (title bar incluse), et non au viewport WebView.

macOS utilise un système de coordonnées flippé (origine en bas à gauche, y croissant vers le haut). wry effectue la conversion vers le système CSS (y croissant vers le bas), mais calcule mal l'offset de la title bar native, générant des coordonnées avec y négatif (ex : `y = -39` sur un écran Retina DPR=2) — c'est un bug connu de wry référencé GitHub Tauri #9966.

Les DOM `dragover` events et `mousemove` ne fire pas pendant un drag Finder (bloqués par l'interception OS), donc il est impossible de tracker la cible côté JS seul.

### Solution : correction via inner_position / outer_position (Rust)

La hauteur de la title bar en pixels physiques est obtenue côté Rust :

```rust
fn get_titlebar_height(window: tauri::Window) -> f64 {
    let outer = window.outer_position().unwrap_or_default();
    let inner = window.inner_position().unwrap_or_default();
    (inner.y - outer.y) as f64
}
```

Côté JS, les coordonnées raw du drop sont corrigées :

```ts
const cssX = rawX / dpr;
const cssY = (rawY + titlebarPhysical) / dpr;
```

Le signe est `+titlebar` (pas `-`) car wry soustrait déjà l'offset title bar lors de la conversion macOS → CSS, créant un décalage négatif qu'il faut compenser. Ces valeurs sont ensuite passées à `document.elementFromPoint` pour identifier le dossier cible.

L'offset est mis en cache après le premier drop (un seul `invoke` Rust pour la durée de vie de l'application).

---

## Menu Fichier macOS et menus contextuels

### Menu Fichier (barre de menu macOS)

Construit dans `setup()` via `SubmenuBuilder` de Tauri. Structure complète : App menu (À propos, Services, Masquer, Quitter), Fichier, Édition (prédéfinis Undo/Redo/Cut/Copy/Paste/SelectAll), Fenêtre (Minimize, CloseWindow). La liste des API disponibles sur `SubmenuBuilder` est plus restreinte que l'équivalent JS — `zoom()` n'existe pas, seul `minimize()` et `close_window()` sont disponibles pour la fenêtre.

`on_menu_event` sur l'`AppHandle` clôné : pour `"import-files"`, appelle `open_import_picker_macos()` directement (déjà sur le thread principal) et émet le résultat. Pour `"reveal-in-finder"` et `"delete-note"`, émet l'event sans payload.

`useMenuEvents` hook (frontend) écoute ces trois events via `@tauri-apps/api/event listen`. La suppression via menu passe par `handleDeleteNote` de `useNote` (même chemin que le bouton 🗑️ du file tree). Le révéler passe par `osascript tell application "Finder" to reveal POSIX file` — `plugin-opener`'s `revealItemInDir` crashait sur macOS (appel `NSWorkspace` hors thread principal dans la Rust side du plugin).

### Menu contextuel natif (desktop)

Utilise `@tauri-apps/api/menu` : `Menu.new({ items })` + `menu.popup()`. Nécessite `"core:menu:default"` dans les capabilities. Le menu est construit à la demande à chaque clic droit (pas de menu persistent) — `MenuItem.new({ text, action })` crée un item avec callback JavaScript, `PredefinedMenuItem.new({ item: "Separator" })` pour les séparateurs.

Le hook `useNodeContextMenu` est instancié une fois dans `FileTree.tsx` et distribué via le contexte `FileDragCtx` (étendu en `FileActions = FileDrop & { onContextMenu }`). Chaque composant nœud appelle `dnd.onContextMenu(e, nodeId, nodeKind)` dans son handler `onContextMenu`.

**Cible d'import.** Dossier cliqué → lui-même ; note ou média cliqué → dossier parent. Calculé au moment du clic, passé dans la closure de l'item "Importer".

**Suppression.** Notes et médias → `handleDeleteNote` (tabs, navigation, cleanupNoteFromBases, writingPathsRegistry, update arbre optimiste). Dossiers → `handleDeleteFolder` (look-up du `FolderNode` depuis `treeAtom` via `findFolderById`, confirmation si non vide). Même source de vérité que le bouton 🗑️ du file tree.

### Menu contextuel mobile (bottom sheet)

`MobileContextMenu.tsx` utilise un tableau d'objets `{ label, destructive?, onPress }` au lieu d'un `switch(idx)` fragile. L'item "Importer des fichiers…" appelle `open({ multiple: true })` puis `importPaths(targetFolderPath, paths)` + `reload()`. L'ordre suit la convention iOS : destructif en dernier.

### Commandes Tauri

| Commande | Description |
|---|---|
| `open_import_picker(AppHandle)` | NSOpenPanel (fichiers + dossiers) depuis JS via run_on_main_thread + oneshot |

---

## iOS & macOS — Synchronisation iCloud

### Architecture retenue

La synchronisation des notes entre l'app iOS et l'app macOS repose sur un **ubiquity container iCloud** (`iCloud.com.md.lueurs`). Le container est créé et possédé par l'app iOS — l'app macOS y accède via le système de fichiers directement, sans entitlements iCloud.

```
iPhone (producteur)                iCloud              Mac (consommateur)
~/Library/Mobile Documents/  ←─── bird ───→  ~/Library/Mobile Documents/
iCloud~com~md~lueurs/                         iCloud~com~md~lueurs/
Documents/                                    Documents/
```

### Pourquoi le container est côté iOS uniquement

L'accès programmatique à un ubiquity container (`FileManager.url(forUbiquityContainerIdentifier:)`) nécessite des entitlements iCloud signés avec un provisioning profile. Côté iOS, c'est géré automatiquement par Xcode. Côté macOS avec une distribution **Developer ID** (hors App Store), embarquer ces entitlements dans le bundle Tauri nécessite un provisioning profile Developer ID avec la capability iCloud — possible mais complexe à intégrer dans le pipeline de build Tauri.

Par ailleurs, même avec ce provisioning profile, `bird` retourne "Client zone not found" côté Mac tant que l'app n'est pas distribuée via l'App Store ou TestFlight — le container n'est pas reconnu comme zone de sync publique par Apple avant ça.

**Conséquence** : le dossier n'apparaît pas dans la barre latérale du Finder sous iCloud Drive, et `brctl status` retourne "Client zone not found". Ce sont des limitations cosmétiques — la synchronisation fonctionne correctement.

### Historique et pièges rencontrés

Plusieurs container IDs ont été tentés avant d'arriver à `iCloud.com.md.lueurs` :

- `iCloud.com.theophiledonato.lueurs` — créé puis supprimé accidentellement ; les identifiants supprimés sont **définitivement blacklistés par Apple**, impossible de les récupérer
- `iCloud.com.theophiledonato.lueurs-tauri` — résidu d'une configuration initiale erronée, également perdu

**À ne jamais faire** : supprimer un container iCloud dans le Developer Portal. L'identifiant est blacklisté définitivement, même si c'est vous qui l'avez créé.

### iOS — Initialisation du container

Au démarrage, l'app iOS appelle une fonction Swift via FFI pour initialiser le container et obtenir son chemin :

**`src-tauri/gen/apple/lueurs-tauri_iOS/ICloudBridge.swift`**
```swift
/// Appel potentiellement bloquant — doit être hors du thread principal.
/// Retourne : nombre d'octets écrits (null inclus), 0 si iCloud indisponible,
/// -1 si buffer trop petit.
@_cdecl("get_icloud_documents_path")
public func getICloudDocumentsPath(
    buffer: UnsafeMutablePointer<CChar>,
    maxLen: Int32
) -> Int32 {
    // nil = premier container listé dans les entitlements
    guard let containerURL = FileManager.default.url(
        forUbiquityContainerIdentifier: nil
    ) else { return 0 }

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
```

Côté Rust, l'appel est fait via `spawn_blocking` (potentiellement bloquant au premier lancement) :

```rust
#[cfg(target_os = "ios")]
async fn icloud_path_impl() -> Option<String> {
    extern "C" {
        fn get_icloud_documents_path(
            buffer: *mut std::os::raw::c_char,
            max_len: i32
        ) -> i32;
    }
    tokio::task::spawn_blocking(|| {
        let mut buffer = vec![0i8; 4096];
        let len = unsafe { get_icloud_documents_path(buffer.as_mut_ptr(), 4096) };
        if len <= 0 { return None; }
        let cstr = unsafe { std::ffi::CStr::from_ptr(buffer.as_ptr()) };
        Some(cstr.to_string_lossy().into_owned())
    })
    .await.ok().flatten()
}
```

Le chemin retourné (`/private/var/mobile/Library/Mobile Documents/iCloud~com~md~lueurs/Documents`) est utilisé comme vault path automatiquement au premier lancement — aucun WelcomeScreen n'est affiché sur iOS.

### Entitlements iOS

**`src-tauri/gen/apple/lueurs-tauri_iOS/lueurs-tauri_iOS.entitlements`** :
```xml
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.md.lueurs</string>
</array>
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudDocuments</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
    <string>iCloud.com.md.lueurs</string>
</array>
```

**`Info.plist` iOS** — rend le dossier visible dans l'app Fichiers iOS (une fois distribué via App Store) :
```xml
<key>NSUbiquitousContainers</key>
<dict>
    <key>iCloud.com.md.lueurs</key>
    <dict>
        <key>NSUbiquitousContainerIsDocumentScopePublic</key>
        <true/>
        <key>NSUbiquitousContainerName</key>
        <string>Lueurs</string>
        <key>NSUbiquitousContainerSupportedFolderLevels</key>
        <string>Any</string>
    </dict>
</dict>
```

### macOS — Accès au container

L'app macOS n'a pas d'entitlements iCloud. Elle accède au container via le chemin statique connu :

```rust
#[cfg(target_os = "macos")]
fn get_icloud_path_macos() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = format!(
        "{}/Library/Mobile Documents/iCloud~com~md~lueurs/Documents",
        home
    );
    if std::path::Path::new(&path).exists() {
        Some(path)
    } else {
        None
    }
}
```

Au premier lancement sur Mac, si le dossier iCloud existe (l'app iOS a déjà été lancée), il est utilisé directement comme vault path. Si le dossier n'existe pas (l'utilisateur commence par le Mac), le file picker s'ouvre avec un message expliquant qu'il faut d'abord installer et lancer l'app iOS.

### Limitations connues et résolution prévue

| Limitation | Cause | Résolution prévue |
|---|---|---|
| Dossier absent du Finder | `bird` ne reconnaît pas le container comme zone publique hors App Store | Publication sur App Store / TestFlight |
| `brctl status` retourne "Client zone not found" | Le Mac n'est pas producteur du container | Idem — cosmétique, n'affecte pas la sync |
| Dossier absent de l'app Fichiers iOS | Même raison | Idem |
| L'utilisateur doit commencer par iOS | Le container est initialisé par l'app iOS uniquement | Idem — une fois sur App Store, le container sera reconnu des deux côtés |

### Points d'attention

- `src-tauri/gen/` est regénéré par `pnpm tauri ios init` — les entitlements et le `PrivacyInfo.xcprivacy` sont écrasés et doivent être réappliqués manuellement si cette commande est relancée
- iCloud ne se synchronise pas dans le simulateur iOS — les tests de sync nécessitent un vrai device
- Le container iCloud `iCloud.com.md.lueurs` est enregistré dans le Apple Developer Portal sous l'App ID `com.theophiledonato.lueurs` — **ne jamais supprimer ce container**

---

## iOS — Spécificités WKWebView

### Barre d'assistance clavier (`disableInputAccessoryView`)

iOS affiche par défaut une barre de navigation au-dessus du clavier sur tout `<input>` focusé (boutons Précédent / Suivant / Valider). Cette barre est inutile dans Lueurs et perturbe le positionnement du `FloatingInput` ancré via `visualViewport`.

**Fix** : `"disableInputAccessoryView": true` dans la config de la fenêtre (`src-tauri/tauri.conf.json`) :

```json
"app": {
  "windows": [
    {
      "disableInputAccessoryView": true
    }
  ]
}
```

Tauri transmet cette option à WKWebView à la création de la webview. Elle est ignorée silencieusement sur macOS/desktop.

**Ce qui n'a pas fonctionné** : patcher `inputAssistantItem` via une catégorie ObjC dans `main.mm` (swizzle de `initWithFrame:configuration:`) — l'approche est correcte en théorie mais n'avait aucun effet visible, probablement parce que Wry recrée ou reconfigure la WKWebView après l'init.

---

## Android — Clavier IME et auto-scroll du caret

### Le problème

Sur Android `targetSdk >= 35`, l'edge-to-edge est forcé (`enableEdgeToEdge()` dans `MainActivity.kt`). Conséquence : `android:windowSoftInputMode="adjustResize"` **ne suffit plus** à redimensionner la WebView quand le clavier s'ouvre — la fenêtre est considérée comme s'étendant sous les system bars et sous l'IME, et c'est à l'app d'appliquer les insets elle-même.

Symptôme observé dans l'éditeur Markdown (`MobileEditor`) : clavier ouvert, l'utilisateur scrolle le caret hors-vue puis tape à nouveau. Le browser Chromium déclenche un auto-scroll natif pour ramener le caret en vue, mais comme la WebView n'a pas été redimensionnée, c'est le **visualViewport entier qui translate** vers le haut. Conséquence : header `fixed` + formatting bar `fixed` translatent avec le reste — toute l'UI disparaît visuellement.

### Solution retenue : insets IME appliqués manuellement côté natif

Dans `MainActivity.kt`, on installe un `setOnApplyWindowInsetsListener` sur le content view (`android.R.id.content`) :

```kotlin
ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
  val sys = insets.getInsets(WindowInsetsCompat.Type.systemBars())
  val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
  view.setPadding(sys.left, sys.top, sys.right, maxOf(sys.bottom, ime.bottom))
  WindowInsetsCompat.CONSUMED
}
```

Le padding bottom devient `max(systemBars.bottom, ime.bottom)`. La WebView occupe alors la zone réellement visible — au-dessus du clavier quand il est ouvert, au-dessus de la nav bar sinon. `window.innerHeight` reflète directement cette hauteur, et le browser n'a plus besoin de translater le visualViewport pour ramener le caret en vue : il scrolle naturellement le scroll container.

### Détection du clavier côté JS (`useAndroidKeyboardOpen`)

Avec la WebView redimensionnée, `visualViewport.height` devient égal à `window.innerHeight` quand le clavier est ouvert — donc `useKeyboardHeight` retourne `keyboardHeight = 0` sur Android, ce qui empêcherait l'affichage de la `MobileFormattingBar`. Pour piloter son apparition, on détecte l'ouverture du clavier différemment : `src/mobile/hooks/useAndroidKeyboardOpen.ts` écoute `window.resize` et compare `innerHeight` au maximum observé. Si la baisse dépasse 150 px, le clavier est considéré ouvert.

Dans `MobileEditor.tsx` :

```ts
const androidKbOpen = useAndroidKeyboardOpen();
const effectiveKbOpen = isAndroid ? androidKbOpen : isKeyboardOpen;
```

La `MobileFormattingBar` reçoit `effectiveKbOpen` et se positionne à `bottom: keyboardHeight + 8`. Sur Android, `keyboardHeight = 0` → `bottom: 8px`, ce qui place la barre juste au-dessus du clavier puisque le bas de la WebView correspond désormais au top du clavier.

### Ce qui n'a pas fonctionné

Plusieurs tentatives infructueuses avant d'arriver à la solution insets natifs — listées ici parce que les pistes paraissent plausibles mais ne résolvent pas le problème racine (edge-to-edge SDK 35+) :

- **`<meta name="viewport" content="… interactive-widget=resizes-content">`** : censé forcer Chromium à redimensionner le visual viewport au lieu de translater. Aucun effet observé dans la WebView Tauri.
- **`overflow: clip` sur tous les ancêtres** (`html`, `body`, `#root`, container MobileApp, container MobileEditor) : tentative pour empêcher tout scroll programmatique de remonter l'arbre. Inefficace, car le translate natif du visualViewport n'est pas un scroll classique d'un ancêtre — il agit au-dessus du DOM.
- **Header en `position: sticky top-0` à l'intérieur du scroll container** (au lieu de `fixed` sibling) : le sticky disparaissait aussi, confirmant que le translate opère au niveau du visualViewport / WebView native, pas au niveau du scroll container.
- **`android:windowSoftInputMode="adjustNothing"` + gestion JS totale via `visualViewport.scroll`** : techniquement viable mais beaucoup plus complexe, et lutte en permanence contre le browser. Abandonné au profit de la solution native qui fixe la cause racine.
- **Hook keyboard-tracking côté JS via `focusin`/`focusout`** : a fait disparaître la formatting bar complètement parce qu'on remplaçait toute la logique `visualViewport` au lieu de la compléter.

### Récap des fichiers touchés

| Fichier | Rôle |
|---|---|
| `src-tauri/gen/android/app/src/main/java/com/theophiledonato/lueurs/MainActivity.kt` | Listener `setOnApplyWindowInsetsListener` qui applique `max(systemBars, ime)` en padding bottom |
| `src-tauri/gen/android/app/src/main/AndroidManifest.xml` | Conserve `adjustResize` (nécessaire en combinaison avec les insets manuels) |
| `src/mobile/hooks/useAndroidKeyboardOpen.ts` | Détection clavier ouvert via baisse de `window.innerHeight` |
| `src/mobile/components/Editor/MobileEditor.tsx` | Structure JSX unifiée iOS/Android, hook Android pour piloter la formatting bar |

iOS n'est pas affecté : `useKeyboardHeight` continue de lire `visualViewport.height` (WKWebView n'est pas redimensionné, le clavier reste un overlay), `effectiveKbOpen` retombe sur `isKeyboardOpen`, et le `paddingBottom` garde sa formule originale `keyboardHeight + MOBILE_TOOLBAR_OFFSET`.

---

## Propagation de templates (Rust)

Lorsque le frontmatter d'un template change, le frontend (`useTemplateSync`) calcule la liste des notes héritières et invoque `propagate_template_change`. Rust traite les fichiers en parallèle (Tokio `JoinSet`) et les écrit directement sur le disque.

La commande reçoit un `TemplateChange` :

- `addProp` — ajoute la propriété si absente
- `removeProp` — supprime la propriété
- `renameProp { old_key, new_key, template_value }` — renomme avec résolution de conflit
- `forceValue` — impose une valeur
- `renameEnumValue { key, old_value, new_value }` — renomme une valeur d'un bouton : met `key` à `new_value` chez les héritiers qui valaient exactement `old_value` (voir [Propriétés à valeurs contraintes (BUTTON)](#propriétés-à-valeurs-contraintes-button))
- `enforceEnum { key, options, default }` — réconciliation : si la valeur de `key` n'est ni dans `options` ni égale à `default`, la réécrit avec `default`

Pour le renommage, Rust parse le frontmatter YAML, détecte si `new_key` est déjà présent (conflit), et applique la règle : valeur du template si propriété imposée ; pour une propriété contraignante, la valeur de `old_key` prime si non vide (prop héritée > prop personnalisée), sinon la valeur existante de `new_key` est conservée. En plus du renommage de clé, Rust met à jour les références à `old_key` dans toutes les formules `$$...$$` des autres propriétés de la même note : `self.old_key` → `self.new_key` et `agg(old_key,` → `agg(new_key,` (avec vérification de frontière de mot pour éviter les faux positifs sur les noms préfixés).

Les bases héritières d'un template sont exclues du batch Rust (elles ne reçoivent pas les propriétés du template). Après le reload du tree, `renameTemplateProperty` les patch séparément via `renameBaseAggregations` : renommage de la clé dans `__TableAggregations__` (JSON) et de la propriété `__Agg_<col>_<op>__` avec sa formule. Cela couvre le cas du renommage depuis le frontmatter du template ; le renommage depuis le header du tableau passe par `renameAggregationKey` (dans `useTable`) qui met aussi à jour l'état local React.

### Agrégations et formules (vue tableau)

**Stockage.** `__TableAggregations__` est un JSON `{colKey: op}` persisté dans la base. Pour chaque agrégation active, une propriété `__Agg_<col>_<op>__` est ajoutée à la base avec pour valeur la formule `$$agg(col,op)$$`. Cette propriété est visible dans le frontmatter de la base et peut être référencée par d'autres formules via `self.__Agg_col_op__`.

**Évaluation.** Les formules `$$...$$` sont évaluées côté frontend à l'affichage (jamais persistées). `computeFormula` (`formulas.ts`) substitue les références `self.prop`, injecte les helpers `round`, `iif`, `agg`, `ref`, et exécute l'expression dans une `Function` sandbox. `agg(col, op)` délègue à `computeAggregation` (`aggregations.ts`) avec un `ValueResolver` pour évaluer récursivement les formules des notes enfant. L'imbrication de formules est supportée (`self.x` où `x` est lui-même une formule), mais `agg()` imbriqué dans `agg()` renvoie `"—"` (pas de contexte enfant au deuxième niveau).

### Références cross-notes dans les formules (`ref()`)

**Syntaxe.** `$$ref("NomNote").propriété$$` — `ref()` est injectée dans le sandbox au même titre que `round`/`iif`/`agg`. En mémoire, les chemins sont absolus (`ref("/vault/Note.md")`). Sur disque, relatifs au vault. Dans l'UI, seul le nom de la note est affiché (jamais le chemin).

**Implémentation de `ref()`.** `ref()` reçoit le chemin absolu, résout la note via `noteResolver`, et retourne un objet pré-calculé (`Object.fromEntries`) avec toutes les propriétés du frontmatter. Les propriétés qui sont elles-mêmes des formules sont évaluées récursivement. Pas de `Proxy` — WKWebView ne supporte pas les Proxy dans les `new Function()` sandbox, ce qui provoque `#ERREUR`. Pour que `agg()` fonctionne dans une note référencée, ses enfants sont extraits depuis `__Children__` et résolus via `noteResolver` avant d'être passés à `computeFormula`.

**Conversion de chemins.** `absolutifyPathFields` et `relativizePathFields` (`vaultIO.ts`) scannent toutes les valeurs frontmatter qui sont des formules (`isFormula(val)`) et convertissent les chemins dans les `ref()` via un regex `FORMULA_REF_RE = /ref\("([^"]+)"\)/g`. Même mécanique que pour `__Base__`/`__Children__`/`__Template__`.

**Humanisation / déshumanisation.** `humanizeFormula(raw, noteResolver)` remplace `ref("/chemin/absolu")` par `ref("NomNote")` pour l'affichage. `dehumanizeFormula(humanized, notesByName)` fait l'inverse avant persistance. Ces deux fonctions sont appliquées à la volée dans `FrontmatterValue` et `TableCell` : l'input affiche le nom, `onTextChange` reçoit le chemin absolu.

**UX de saisie.** La détection des triggers est basée sur la position du curseur (`e.target.selectionStart`), pas sur la fin de chaîne — ce qui permet d'insérer une référence en milieu de formule. Les triggers :
- `ref(` au curseur → ouvre `NoteSelector` ; la note sélectionnée insère `ref("NomNote")` et positionne le curseur après le `)`.
- `ref("NomNote").` au curseur → ouvre `PropertySelector` ; la propriété sélectionnée est insérée après le `.`.

`selectorOpenRef` (useRef, toujours à jour) est utilisé dans `onBlur` pour éviter le problème de stale closure : l'état React `refSelectorOpen` est `false` au moment où `onBlur` capture la closure, ce qui provoquerait un commit prématuré.

**Auto-pair `$$`.** En mode texte standard (hors formule), taper le premier `$` insère automatiquement le `$` fermant et positionne le curseur entre les deux paires. `autoPairedRef` (useRef) marque l'intention ; un `useEffect` qui s'exécute à chaque render détecte la transition `texte → formule` et bascule en mode édition de formule si `autoPairedRef` est armé.

**Sérialisation YAML.** Les formules contenant des virgules (ex : `$$agg(montant, sum)$$`) étaient parsées par le sérialiseur YAML comme des tableaux multi-lignes. Fix dans `parseFrontmatter` : si la réassemblage des items donne une chaîne `$$...$$`, elle est stockée comme une chaîne unique. Fix dans `serializeFrontmatter` : les valeurs `$$...$$` sont quotées avec `'...'` pour empêcher l'interprétation YAML.

### Résolution des propriétés template (frontend)

`computeTemplateProps` (`fileTreeHelpers.ts`) calcule les propriétés qu'une note doit recevoir d'après ses templates. Elle distingue propriétés imposées (valeur non vide dans le template) et contraignantes (valeur vide), et ne modifie jamais une valeur déjà renseignée par la note pour une propriété contraignante. Pour une propriété BUTTON, elle attribue le `default` à la création et réécrit toute valeur non permise vers le `default` (filet de sécurité au chargement, en complément de `enforceEnum` côté live).

### Propriétés à valeurs contraintes (BUTTON)

`$$BUTTON([v1;v2;v3],default)$$` déclaré dans un template définit une liste de valeurs autorisées. C'est une contrainte **déclarative** : contrairement aux formules `round`/`agg`/`ref`, un BUTTON n'est jamais évalué dans le sandbox. L'héritier ne stocke que la valeur littérale choisie (jamais la formule).

**Parsing (`buttonProperty.ts`).** `parseButton` renvoie `{ options: ButtonOption[]; default }`, où `ButtonOption = { value; color? }`. Séparateur `;` à l'intérieur des crochets (évite le conflit avec la `,` des arguments). `default` vide → première valeur. Une option peut être colorée via `=={color}label==` / `==label==` (syntaxe reprise du surlignage) ; couleur omise → `defaultHighlightColorRef.current` (réglage courant). `diffButtonOptions` compare **par valeur** (la couleur n'affecte pas les héritiers) avec la même heuristique 1-retirée/1-ajoutée que `diffFrontmatter` pour détecter un renommage.

**Contraintes.** `useTemplateConstraints` expose, en plus de `lockedKeys`/`lockedValues`, une `Map<key, ButtonDef>` (`enumConstraints`) : une clé BUTTON est verrouillée mais **pas** dans `lockedValues` (valeur éditable). `useTable` calcule de même un `enumConstraint` par colonne (`isImposed = false` pour un BUTTON).

**Propagation des changements du template.** `diffFrontmatter` (`useTemplateSync`) détecte qu'une valeur reste un BUTTON entre `prev` et `next` (n'émet donc jamais de `forceValue`) et, via `diffButtonOptions`, pousse un `renameEnumValue` par renommage de valeur et un `enforceEnum` si des options ont disparu. Un `addProp` d'un BUTTON envoie le `default` (pas la formule). La mise à jour chirurgicale du tree applique la même logique localement.

**Rendu.** `EnumValueSelector` (`shared/components`) — pill + dropdown (réutilise `AnchoredDropdown`, donc compatible mobile) — affiche la valeur dans sa couleur (mapping highlight→Tailwind dans `enumPillColors.ts`, fond `-400`/texte `-600`, `purple`→`purple`, `yellow`→`amber`). Utilisé dans `FrontmatterValue`, `TableCell` et `MobileTableCell`. `enumValueState` distingue `valid` / `placeholder` (valeur = default hors-liste) / `invalid` (signalé en rouge, en attendant la réécriture). Dans le frontmatter du **template**, la vue compactée passe par `ButtonOptionsEditor` : pills surlignées + dot color-picker au survol (palette `HIGHLIGHT_COLORS`) qui réécrit la formule via `serializeButton` ; un clic sur le fond bascule en édition brute de la formule.

---

## Caret personnalisé (`customCaretPlugin`)

### Pourquoi remplacer le caret natif

Deux défauts du caret natif dans un `contenteditable` ProseMirror :

1. **Hauteur dictée par `line-height`.** Sur les paragraphes (`line-height: 1.5`), le caret mesurait 24 px alors que le texte fait 16 px. Sur les titres (`line-height: 1`), le problème n'existait pas.
2. **Déplacement sans transition.** Le caret saute de position en position, sans fluidité.

### Implémentation (`src/shared/plugins/custom-caret/customCaretPlugin.ts`)

Plugin ProseMirror enregistré via `$prose` (même pattern que `wordHighlightPlugin`). Il utilise le hook `view()` de ProseMirror pour gérer un `<div class="custom-caret">` unique en `position: fixed` dans `document.body`.

**Positionnement.** À chaque `update()`, `view.coordsAtPos(from)` donne les coordonnées viewport du curseur. La taille de fonte courante est lue via `getComputedStyle(el).fontSize` sur l'élément DOM au curseur — ce qui donne la bonne valeur à tous les niveaux de titre. Hauteur du caret = `fontSize × 1.3`, centré verticalement dans la line-box.

**Transitions.** `transition: left 90ms cubic-bezier(0.2, 0, 0, 1)` pour les déplacements normaux. La classe `.no-transition` (qui pose `transition: none`) est appliquée pour les sauts > 120 px (clic lointain, Ctrl+Home) et pendant le scroll — sans quoi le caret glisserait en retard derrière le texte.

**Scroll.** `document.addEventListener("scroll", ..., true)` en capture phase repositionne le caret sur tout événement scroll, quel que soit le conteneur.

**Clignotement.** `@keyframes caret-blink` sur `opacity`. L'animation est réinitialisée (`style.animation = "none"` puis restaurée via `requestAnimationFrame`) à chaque déplacement du curseur, pour repartir de visible.

**Desktop uniquement.** Le plugin n'est ajouté à l'éditeur que si `isDesktop` — les plateformes mobiles conservent leur caret natif.

### Limitation WebKit : `max-width` sur pseudo-élément

Lorsque le curseur entre dans un titre, `headingMarkerPlugin` ajoute la classe `heading-marker-visible` au `<h1>`, déclenchant une transition CSS `max-width: 0 → 2.5ch` sur le pseudo-élément `::before` de `.heading-content`. Ce pseudo-élément pousse le texte vers la droite visuellement.

**Le problème :** dans WKWebView (Tauri/macOS), `getBoundingClientRect()` — utilisé en interne par `view.coordsAtPos()` — ne reflète pas les valeurs intermédiaires d'une transition `max-width` sur un pseudo-élément. La valeur finale n'est accessible qu'une fois la transition terminée. Les appels à `coordsAtPos()` pendant la transition retournent donc toujours la position pré-animation, quelle que soit la cadence d'appel.

**La solution :** écouter `transitionend` sur `editorView.dom`. L'événement fire sur `.heading-content` (l'élément propriétaire du `::before`) avec `e.propertyName === "max-width"`, et bubble jusqu'au `.ProseMirror`. À la réception, `reposition()` est appelé une dernière fois en mode snap (`no-transition`) pour corriger la position du caret.

```typescript
editorView.dom.addEventListener("transitionend", (e: TransitionEvent) => {
  if (e.propertyName === "max-width") reposition(editorView, true);
});
```

Pendant les 160 ms de la transition, le caret reste à la position pré-animation, puis snappe à la position finale. C'est le comportement le plus honnête compte tenu de la limitation WKWebView.

---

## Raccourcis clavier et menu contextuel de l'éditeur

### Architecture

Les raccourcis et le menu contextuel sont implémentés en dehors du preset Milkdown, dans deux fichiers :

- `src/plugins/customKeymap.ts` — commandes ProseMirror et plugins keymap
- `src/components/NoteEditor/hooks/useContextMenu.ts` — menu contextuel natif macOS via Tauri

### Commandes toggle (`$command` Milkdown)

Toutes les commandes structurelles sont exportées depuis `customKeymap.ts` et enregistrées dans l'éditeur via `.use()`. Chaque commande implémente un comportement **toggle** : réappuyer sur le raccourci dans une structure l'enlève.

| Commande | Toggle off | Transition cross-structure |
|---|---|---|
| `toggleBlockquoteCommand` | `lift` | oui |
| `toggleBulletListCommand` | `liftListItem` | oui |
| `toggleOrderedListCommand` | `liftListItem` | oui |
| `toggleTaskListCommand` | `liftListItem` | oui |
| `toggleHeadingCommand` | `setBlockType(paragraph)` | oui (escape depuis liste) |
| `toggleCodeBlockCommand` | `setBlockType(paragraph)` | oui |

**Détection de la structure courante** : remontée des ancêtres ProseMirror via `$from.depth` — pas de parsing markdown.

**Transitions cross-structure** (ex. titre → liste, citation → checkbox) : deux helpers composent plusieurs commandes ProseMirror en **une seule transaction** pour que l'opération soit atomique (un seul undo) :

- `buildEscapeCommand(state, schema)` — retourne la commande de sortie adaptée à la structure courante (liste → `liftListItem`, blockquote → `lift`, heading/code_block → `setBlockType(paragraph)`)
- `applyThenApply(state, dispatch, first, second)` — exécute `first` sans dispatcher, applique son résultat sur un état intermédiaire, exécute `second` sur cet état intermédiaire, puis accumule tous les steps dans une transaction combinée. Les positions restent correctes car chaque jeu de steps est calculé relatif au document issu des steps précédents.

### Sortie de liste : override Entrée / Backspace

Le preset commonmark mappe `Enter` → `splitListItem`, `Backspace` → `liftFirstListItem` (= `joinBackward`), `Tab`/`Shift-Tab` → `sinkListItem`/`liftListItem`. Le schéma `list_item` du preset a pour contenu `paragraph block*` : un item peut donc contenir plusieurs paragraphes. Deux comportements natifs étaient gênants :

- **Sortie d'une liste imbriquée par Entrée** : `splitListItem` ne sort qu'**un niveau à la fois** (il splitte l'item parent), jamais directement à la racine.
- **Backspace sur un item vide** : `joinBackward` fusionne le paragraphe vide comme **2e paragraphe de l'item précédent** (autorisé par `paragraph block*`). Visuellement, une ligne sans puce apparaît alors qu'on est toujours *dans* l'item du dessus → un `Tab`/`Shift-Tab` suivant indentait l'item visible au-dessus, et la frappe modifiait son rendu (item passé en « loose »).

**Override** (dans `customKeymapPlugin`, `customKeymap.ts`) — `Enter` et `Backspace` sont interceptés **avant** le preset (cf. *Précédence des keymaps* ci-dessous) :

- `Enter` sur le paragraphe vide d'un `list_item` → `liftOutOfList` : sort de **tous** les niveaux d'un coup. Sinon `return false` → `splitListItem` natif (nouvel item).
- `Backspace` sur le paragraphe vide d'un `list_item` → `liftListItem` une seule fois (remonte d'un niveau, structure propre). Sinon `return false` → comportement natif. Comme on ne passe plus par `joinBackward`, le paragraphe piégé ne peut plus se former.
- `Tab`/`Shift-Tab` ne sont **pas** overridés : ils redeviennent sains mécaniquement une fois le piège du Backspace supprimé.

`liftOutOfList(schema)` applique `liftListItem` en boucle sur les états intermédiaires tant que la sélection reste dans une liste, accumule les steps et les rejoue en une transaction unique sur l'état initial — même technique de composition que `applyThenApply` (positions valides car chaque step est calculé sur le document issu des steps précédents). Garde-fou à 20 itérations contre une structure inattendue.

### Précédence des keymaps (pourquoi l'override fonctionne)

À la création de la vue, le cœur Milkdown assemble les plugins ProseMirror ainsi : `[...prosePlugins, stateTracker, customInputRules, keymap(km.build())]`. Tous les `$useKeymap` (preset inclus : `listItemKeymap`, `headingKeymap`…) sont fusionnés dans le **dernier** plugin via un `KeymapManager` (tri par `priority`, chaînage `chainCommands`). Or `customKeymapPlugin` est un `$prose(keymap(...))` qui vit dans `prosePlugins`, donc **placé avant** ce keymap fusionné. ProseMirror essaie les plugins dans l'ordre du tableau et s'arrête au premier `handleKeyDown` qui renvoie `true` → nos handlers `Enter`/`Backspace` passent avant `splitListItem`/`liftFirstListItem` du preset. S'ils renvoient `false`, le preset reprend la main normalement.

### Désactivation du keymap du preset pour les titres

Le preset `commonmark` enregistre `Mod-Alt-1` à `Mod-Alt-6` via `$useKeymap` / `headingKeymap`, appelant `wrapInHeadingCommand` (sans toggle, prioritaire sur notre keymap). Pour prendre la main, on vide ces shortcuts dans la config de l'éditeur :

```ts
ctx.set(headingKeymap.key, {
  TurnIntoH1: { shortcuts: "" },
  // ...
  DowngradeHeading: { shortcuts: ["Delete", "Backspace"] }, // conservé
});
```

Seul les `shortcuts` sont configurables via `ctx.set(headingKeymap.key, ...)` — les commandes associées sont capturées dans la closure de `$useKeymap` à la création et ne sont pas remplaçables par cette voie.

### Problème AZERTY : event.key vs event.code

**Cause générale** : `keymap()` de ProseMirror utilise `event.key` (le caractère produit) pour matcher les raccourcis. Sur AZERTY macOS, certaines combinaisons produisent un caractère spécial au lieu du caractère attendu :

| Combinaison | `event.key` sur AZERTY | Attendu par keymap |
|---|---|---|
| Cmd+Option+3 | `"#"` | `"3"` |
| Cmd+Option+4 | `"{"` | `"4"` |
| Cmd+Option+5 | `"["` | `"5"` |
| Cmd+² (touche Backquote) | `"²"` | `` "`" `` |

**Fix** : `codeBasedShortcutsPlugin` — plugin ProseMirror avec `handleKeyDown` qui utilise `event.code` (position physique de la touche, indépendante du layout). Tous les raccourcis sensibles au layout y sont centralisés :

- `Mod+Alt+Digit0..6` → paragraphe / titres 1–6
- `Mod+Alt+KeyC` → bloc de code
- `Mod+Backquote` → code inline (`toggleInlineCodeCommand`)
- `Mod+Shift+KeyK` → lien (`toggleLinkCommand`)

Pour le code inline : le preset Milkdown enregistre `Mod-\`` nativement. Sur QWERTY il gère en priorité (plugin registeré avant le nôtre) ; sur AZERTY `event.key: "²"` ne matche pas le preset, notre handler `event.code: "Backquote"` prend le relais. Pas de double déclenchement.

`event.code` est la position physique (`"Digit3"`, `"Backquote"`, `"KeyK"`) quelle que soit la langue du clavier.

### Menu contextuel natif (`useContextMenu`)

Le hook `useContextMenu` construit un menu natif macOS via `@tauri-apps/api/menu` (`Menu`, `MenuItem`, `Submenu`, `PredefinedMenuItem`) et l'affiche avec `menu.popup()` (positionné automatiquement au curseur).

Les labels incluent les raccourcis directement dans le texte (`"Gras\t⌘B"`) car Tauri 2 n'affiche pas les `accelerator` dans les menus contextuels popup.

L'insertion de tableau utilise `insert()` de `@milkdown/kit/utils` qui parse du markdown et insère la tranche résultante à la position du curseur. L'insertion d'image et d'audio ouvre un dialog natif Tauri (`@tauri-apps/plugin-dialog`) puis délègue à `insertImageBlock` / `insertAudioBlock` déjà disponibles dans `MarkdownEditor`.

**Snapshot de la sélection.** Le menu natif Tauri vole le focus de la WebView : quand l'`action` d'un item s'exécute (après `menu.popup()`), la sélection ProseMirror n'est plus active. Les commandes structurelles (titres/listes) s'en sortaient car elles se résolvent depuis une position de bloc, mais toutes les commandes opérant sur `state.selection` (code inline, gras, surlignage, didascalie…) faisaient silencieusement un no-op. Fix : on capture `{from, to}` au moment du clic droit, puis avant chaque commande on `view.focus()` et on restaure la sélection via `TextSelection.create` avant d'appeler la commande.

---

## Styles inline : marques ProseMirror, pas nœuds (`didascalie`, `highlight`)

### Décision : marque (`$mark`) et non nœud inline à contenu

Didascalie (`||texte||`) et surlignage (`=={color}texte==`) ont d'abord été implémentés comme des **nœuds inline à contenu éditable** (`content: "text*"` / `"inline*"`), rendus par un NodeView avec des spans délimiteurs `contenteditable=false`. Cette modélisation est un anti-pattern ProseMirror : **WebKit ne sait pas placer ni déplacer le caret sur la position neutre juste après un tel nœud quand il termine un bloc texte**. Tous les bugs observés en découlaient :

- impossible d'atteindre une position après le dernier mot stylé (caret piégé dans le contenu) ;
- la frappe du délimiteur final / la navigation flèche renvoyaient le caret en début de ligne (position modèle-valide mais non mappable à un caret DOM en fin de bloc) ;
- Entrée scindait le paragraphe *à travers* le nœud → nœud vide recréé à la ligne ;
- Backspace ne supprimait pas un nœud inline vide depuis l'intérieur.

**Une marque règle tout à la racine** : ProseMirror gère nativement les frontières de marques (le curseur vit dans du texte ordinaire, la marque est juste une décoration). Plus de NodeView, plus de plugin de navigation custom.

| Aspect | Nœud inline à contenu | Marque |
|---|---|---|
| Frontières du caret | à gérer manuellement (cassé sous WebKit) | natives |
| Entrée / Backspace | comportements custom requis | natifs |
| Schéma | `$node` + `content` + NodeView | `$mark` + `toDOM` |
| Sérialisation | `addNode("text", "||")` autour de `next(content)` | `withMark(mark, type, …)` + handler remark-stringify |
| Délimiteurs visuels | spans `contenteditable=false` | pseudo-éléments CSS `::before`/`::after` |
| Sélection cible des toggles | nœud (`replaceWith`, `setNodeMarkup`) | plage de texte (`toggleMark`, `addMark`/`removeMark`) |

### Sérialisation (le point délicat)

Le runner `toMarkdown` de la marque appelle `state.withMark(mark, "didascalie_inline")` (resp. `"highlight"` avec `{ color }`). `withMark` ouvre un nœud mdast `{ type, children, …props, isMark: true }` qui enveloppe le run de texte marqué — mais remark-stringify ne connaît pas ces types custom.

Le handler de sérialisation est donc enregistré **dans le plugin remark lui-même** : l'attacher unified lit `this.data().toMarkdownExtensions` et y pousse un `handlers` pour le type. Possible car le cœur Milkdown construit **une seule** instance remark (parse + stringify) en réduisant tous les plugins `$remark` via `.use()` ; remark-stringify lit `toMarkdownExtensions` depuis les data du processeur.

```ts
// remark-inline.ts (didascalie)
function remarkDidascalieInline(this: any) {
  const data = this.data();
  (data.toMarkdownExtensions ||= []).push({
    handlers: {
      didascalie_inline(node, _p, state, info) {
        const exit = state.enter("didascalie_inline");
        const value = state.containerPhrasing(node, { ...info, before: "|", after: "|" });
        exit();
        return `||${value}||`;
      },
    },
  });
  return (tree) => processInlineChildren(tree); // parsing texte → nœud mdast (inchangé)
}
```

Le parsing (texte `||texte||` → nœud mdast → `openMark`/`next`/`closeMark`) est symétrique et inchangé par rapport à la version nœud.

### Sortie de style propre

- `inclusive: false` sur les deux marques : le curseur juste après la marque n'est **pas** dedans → on tape du texte normal après le dernier mot, même en fin de ligne. C'est ce qui résout définitivement le symptôme « je ne peux que continuer à écrire dans le style ».
- `excludes: "_"` sur la didascalie : aucune marque imbriquée. Indispensable car `||**x**||` se reparserait en `||` + strong + `||` (les `||` se retrouvent dans des text nodes séparés) → didascalie perdue. Le surlignage, lui, autorise les marques internes (limitation préexistante : `=={c}**x**==` ne se re-détecte pas, car même problème de text nodes scindés ; non régressif).

### Input rules — `markRule`

Les deux input rules utilisent `markRule(regex, markType, options)` de `@milkdown/kit/prose` (au lieu d'un `InputRule` custom). `markRule` retire les délimiteurs, applique la marque sur le seul groupe capturé, et **réinitialise les stored marks** → on continue à taper hors marque. Le plugin `inputRules` saute déjà nativement les blocs de code et les marques code (`spec.code`), donc pas de garde-fou manuel à maintenir.

### Color-picker (surlignage)

Le picker (`color-picker.ts`) opérait sur le nœud (`nodeAt`, `setNodeMarkup`, `replaceWith`). En marque, il faut la **plage contiguë** : `highlightRangeAt(state, pos, hlType)` part de `posAtDOM(target, 0)` puis étend à gauche/droite tant que `nodeBefore`/`nodeAfter` portent la marque highlight de même couleur (la marque peut couvrir plusieurs text nodes si du gras/italique la traverse). Re-colorer = `removeMark` puis `addMark` sur la plage ; supprimer = `removeMark`.

### Toggles

`toggleDidascalieInlineCommand` / `toggleHighlightInlineCommand` : sur sélection vide à l'intérieur de la marque, on l'enlève sur toute la plage contiguë (helper `markRangeAround` dans `customKeymap.ts`) ; sur sélection, `toggleMark` (didascalie) ou applique/re-colore (highlight). Les noms de commandes et leurs `.key` sont conservés → aucun appelant externe à toucher (`editorCommands.ts`, `formattingMenuData.ts`, barre mobile).

### Échappement des marques inclusives du preset

Les marques du preset (gras/italique/code/barré) restent **inclusives** (leurs schémas sont bundlés dans `commonmark`/`gfm`, override global trop risqué). `escapeInlineMarksPlugin` (keymap) gère le cas en fin de bloc : première `ArrowRight` en fin de textblock avec marques actives → `setStoredMarks([])` (caret immobile, frappe suivante non stylée) ; seconde `ArrowRight` → navigation normale (les stored marks valent désormais `[]`, donc le handler rend la main). Sans effet sur nos marques non-inclusives (leurs marques n'apparaissent pas dans `$cursor.marks()` en fin de run).

---

## Liens entre notes (`src/shared/plugins/wikilink/`)

### Décision : mark `link` standard, pas de nœud custom

Une première version utilisait un nœud ProseMirror `wikilink` dédié (avec schéma, remark, NodeView, input-rules). Abandonnée : un nœud distinct multiplie les formalismes et faisait craindre des régressions sur les liens de base/enfant du frontmatter. Les liens entre notes sont donc des **liens markdown standard** `[texte](chemin.md)` réutilisant la **mark `link`** du preset commonmark. `href` = chemin relatif au vault, **extension comprise**. Aucune sérialisation custom : le markdown produit est lisible par n'importe quel éditeur (le nom `wikilink/` du dossier est resté par historique).

Le bundle `wikilinkPlugin` agrège trois plugins ProseMirror : `note-link-plugin`, `suggest-plugin`, `link-boundary-plugin`.

### `note-link-plugin` — clic + décorations

- **Clic** (`handleClick`) : lit `event.target.closest("a")`. Lien externe (`http`/`mailto`/`www.` via `isExternalHref`) → `openUrl` (plugin opener). Lien de note → `wikilinkBridge.resolve(href)` puis `wikilinkBridge.open(noteId, newTab)` avec `newTab = metaKey || ctrlKey`. Lien cassé → `return false`.
- **Décorations** (`Decoration.inline`) : classe `note-link` (bleu) ou `note-link-broken` (rouge pointillé selon que la cible existe). Recalcul sur `tr.docChanged` ou sur le meta `REBUILD_META` — ce dernier permet de revalider le statut cassé/valide quand l'arbre de notes change **sans transaction sur le doc** (`refreshNoteLinkDecorations(view)`, appelé par `MarkdownEditor` à chaque mise à jour de l'arbre).
- `wikilinkBridge` (ref module-level) découple le plugin PM de jotai/React. `MarkdownEditor` l'alimente : `resolve(href) → noteId` (avec fallback `decodeURIComponent`), `open(noteId, newTab)`.

### `suggest-plugin` — deux déclencheurs d'autocomplétion

Le plugin (`compute`) calcule l'état du popup à partir du texte avant le curseur (`textBetween`, les nœuds atomiques remplacés par un `LEAF` pour garder l'alignement offsets ↔ positions) :

1. **`[alias](query`** — détecté en priorité par `/\[([^[\]]*)\]\(([^)\n]*)$/`. Le curseur est dans la parenthèse cible d'un lien markdown en cours de frappe — la forme réellement encodée. `alias` (groupe 1) est conservé comme texte du lien ; `query` (groupe 2) filtre les notes.
2. **`[[query`** — wikilink classique : `lastIndexOf("[[")`, requête invalide si elle contient `]`, `[` ou `LEAF`.

L'état (`from`, `to`, `query`, `alias?`, `coords`) est publié via un store externe (`wikilinkSuggestState`, pub/sub) lu par `WikilinkSuggest.tsx` en `useSyncExternalStore`. À la sélection, on remplace `from..to` par un nœud texte portant la mark `link` (`schema.text(alias?.trim() || candidate.name, [linkMark.create({ href: relpath })])`) puis `tr.removeStoredMark(linkMark)`.

> Les plugins ProseMirror sont instanciés **une fois** à l'init de l'éditeur : une modif du `suggest-plugin` ne prend pas effet en HMR, un rechargement complet est nécessaire pour tester.

### `link-boundary-plugin` — mark `link` non-inclusive

La mark `link` du preset est **inclusive** : un caret collé à la fin d'un lien (lien en bout de ligne sans espace) reste « dans » le lien, et la frappe suivante s'ajoute au texte du lien. Le plugin rétablit le comportement non-inclusif via `appendTransaction` : si la sélection est vide, que les marks au curseur contiennent `link` et que le **nœud suivant ne porte pas** la mark `link` (frontière droite, ou fin de bloc), on retire `link` des stored marks. Aucune boucle : au tour suivant les stored marks ne contiennent plus `link`. À l'intérieur du lien (nœud suivant marqué) ou à sa frontière gauche (`$pos.marks()` ne contient pas `link`), le plugin ne fait rien.

### Édition de lien et positionnement du popup (`WikilinkEditPopup.tsx`)

Le menu contextuel (`useContextMenu` via `linkRangeAt`), l'appui long mobile (`MobileLinkMenu`) et `⌘⇧K` (`toggleLinkWithPromptCommand`) ouvrent le même éditeur, alimenté par le store `wikilinkEditState` (`range` requise, `coords?` optionnelle, `initialQuery`, `initialAlias`). Mobile fournit des `coords` fixes ; desktop les recalcule.

Quand la cible est hors viewport, lire `coordsAtPos` donnerait une ancre fausse. `WikilinkEditPopup` scrolle d'abord la position dans la vue avec **les mêmes marges que le scroll auto à la frappe** : `scrollPosIntoViewLikeEditing` (`lib/editorScroll.ts`) réutilise les constantes de `useCaretScroll` (inset header `DESKTOP_HEADER_HEIGHT` / `MOBILE_HEADER_HEIGHT` + `CARET_TOP_PADDING` en haut, `CARET_BOTTOM_PADDING` en bas) en ajustant `scrollTop` du conteneur scrollable instantanément — sinon une cible au-dessus du viewport restait coincée sous le header fixe. Puis `clampPopup` (`lib/popupPosition.ts`) borne horizontalement et bascule au-dessus de l'ancre en cas de débordement bas.

### Propagation au renommage / déplacement (`usePathPropagation`)

Renommer ou déplacer une note réécrit les `href` des liens markdown dans le corps des notes concernées via `rewriteNoteLinkHrefs(body, mapHref)` (`wikilinkRewrite.ts`). La regex `/(!?)\[([^\]]*)\]\((<[^>\n]+>|[^)\s]+)((?:\s+"[^"]*")?)\)/g` ignore les images (`!`), gère les URL encadrées par `<>` (cas des chemins à espaces, produit par mdast) et préserve les titres. La logique du frontmatter (`__Base__`/`__Children__`) est inchangée.

---

## Plugin audio-block (`src/shared/plugins/audio-block/`)

### Intégration dans l'éditeur

Un lien Markdown dont l'URL se termine par une extension audio (`mp3`, `m4a`, `wav`, `ogg`, `flac`, `aac`, `opus`, `webm`…) est converti en nœud ProseMirror `audio_block` par le plugin remark (`remark-plugin.ts`). La détection se fait sur un paragraphe à enfant unique de type `link`. Le nœud est sérialisé en `[titre](src)` — format Markdown standard, lisible dans tout autre éditeur.

Le plugin exporte trois tranches Milkdown : `audioBlockRemark` (remark), `audioBlockSchema` (nœud ProseMirror), `$view(...)` (NodeView).

### NodeView shell (`node-view.ts`)

Le NodeView crée un `<div>` conteneur, y monte un arbre React via `createRoot`, et expose l'interface NodeView ProseMirror. Les refs mutables partagées entre le shell et le composant React permettent de ne pas remonter React à chaque mise à jour ProseMirror :

- `nodeRef` — le nœud courant (muté avant chaque `render()`)
- `selectedRef` — état de sélection ProseMirror
- `titleEditingRef` — vrai quand l'input titre est actif (bloque `stopEvent`)
- `playToggleRef` — fonction play/pause, mise à jour par le composant à chaque render pour capturer l'état React courant (`isPlaying`)

`stopEvent` retourne `true` pour les éléments `[data-ab-interactive]` (waveform, contrôles) — ProseMirror ne traite pas leurs événements. Le header n'a pas cet attribut, laissant ProseMirror créer une `NodeSelection` au clic dessus.

**Barre espace.** Quand le bloc est sélectionné, `selectNode` ajoute un listener `keydown` en **phase capture** sur `document` (pour intercepter avant ProseMirror, qui sinon remplacerait la sélection par un espace). Le listener est retiré dans `deselectNode` et `destroy`.

### Chemin desktop : Web Audio API

**Problème original.** L'utilisation d'un élément `<audio>` HTML5 avec un blob URL entraînait un délai ~1s entre le clic play et l'arrivée du son. Cause : macOS/WKWebView doit initialiser sa session audio (`AVAudioSession`) au premier play, ce qui prend ~1s. Pendant ce temps, l'élément signalait `currentTime` croissant mais ne produisait pas de son.

**Solution.** On utilise `AudioContext` + `AudioBufferSourceNode` (Web Audio API) :

1. Au chargement, `readAudioData` lit les octets du fichier. `drawWaveform` reçoit un `AudioContext` créé par le composant et appelle `decodeAudioData` — ce décodage initialise la session audio macOS. **L'`AudioContext` n'est pas fermé** après le décodage : `ctx.close()` libérerait la session, recréant le délai au play suivant.

2. Au click play, `ctx.resume()` est appelé. Comme la session est déjà initialisée par le décodage, le résumé est quasi-instantané (quelques ms). Un `AudioBufferSourceNode` est créé depuis l'`AudioBuffer` en mémoire — aucun décodage supplémentaire — et `source.start(offset)` démarre la lecture immédiatement.

3. La position courante est calculée en RAF : `pos = playOffset + (ctx.currentTime - playStartCtxTime)`. `ctx.currentTime` est l'horloge hardware du contexte audio, avec une résolution sub-milliseconde.

**Seek.** `AudioBufferSourceNode` ne supporte pas le seek en place. La méthode correcte : `source.stop()`, créer un nouveau `BufferSourceNode`, `source.start(0, newOffset)`.

**Coordination multi-blocs.** Un `_globalDesktopStop` module-level stocke la fonction d'arrêt du bloc actif. Quand un nouveau bloc démarre, il appelle `_globalDesktopStop()` puis enregistre sa propre fonction. Cela garantit qu'un seul bloc joue à la fois.

**`waveform.ts`.** `drawWaveform(canvas, ctx, buffer, onDone, onError)` — l'`AudioContext` est passé en paramètre et non créé en interne. `onDone` reçoit l'`AudioBuffer` décodé, que le composant stocke pour la lecture. La fonction ne ferme jamais le contexte.

### Chemin mobile : tauri-plugin-native-audio

`nativeAudioPlayer.ts` expose une API unifiée (`nativeLoad`, `nativePlay`, `nativePause`, `nativeSeek`, `nativeSubscribe`). Sur mobile, ces fonctions délèguent à `tauri-plugin-native-audio` (lecteur système iOS/Android). Sur desktop, ces fonctions sont des no-ops — la lecture passe entièrement par Web Audio dans le composant.

`nativeSubscribe(nodeId, callback)` enregistre un callback pour les mises à jour d'état (currentTime, duration, isPlaying, status). Le composant met à jour les DOM refs directement dans ce callback (sans passer par le state React) pour éviter les re-renders à 60 fps.

### Sélection et focus

Cliquer sur le bouton play ou la waveform appelle `view.dispatch(tr.setSelection(NodeSelection.create(...)))` + `view.focus()` explicitement — nécessaire parce que `stopEvent` retourne `true` pour ces éléments, empêchant ProseMirror de traiter le click et de créer la sélection lui-même.

---

## Plugins rendus en React : quand migrer (et quand non)

Historiquement tous les plugins manipulent le DOM impérativement. Le bloc audio fait exception : son rendu est un composant React+Tailwind monté via `createRoot`. Cette philosophie facilite le restylage (classes Tailwind au lieu de `style.cssText`), mais elle ne convient **pas à tous les plugins**. Règle de décision retenue :

**Migrable avec gros bénéfice — widget flottant singleton.** Le picker de couleur du surlignage (`highlight/HighlightColorPicker.tsx`) suit ce modèle. Un **seul** root React vit dans `document.body` ; le plugin ProseMirror (`color-picker.ts`, `handleDOMEvents.mouseover/mouseleave` + `highlightRangeAt`) reste inchangé et appelle `show`/`hide`. La logique métier (`applyColor`, `removeHighlight`) ne bouge pas — seul le rendu passe de DOM impératif à React. C'est le cas idéal : aucun contenu éditable, un singleton (zéro coût par nœud), et un visuel riche (dropdown, swatches) qui gagne énormément à être en Tailwind.

**Non migré volontairement — NodeViews à `contentDOM` (task-list, heading-fold).** Deux raisons cumulées :
1. **Coût perf.** Un NodeView est instancié *par nœud*. Migrer en React monterait un root React par `<li>` et par heading — potentiellement des centaines dans un document. Le singleton du picker n'a pas ce problème.
2. **Le style est piloté par l'élément parent, pas par le chrome.** Le chevron de fold dépend de `h{n}[data-folded]` et de `h{n}:hover` (pseudo-classe CSS sur le heading) ; la checkbox dépend de `li[data-checked]` et d'unités `em` relatives. Reproduire ces états en Tailwind dans le composant React imposerait de traquer le survol en JS et de fragmenter le style. Le CSS d'état centralisé est ici supérieur.

**Si on migre quand même un NodeView : React ne possède que le chrome, jamais le `contentDOM`.** Le pattern sûr est de monter le root React sur un `<span contentEditable="false">` **frère** du `contentDOM` (que ProseMirror garde sous son contrôle exclusif), et non sur le conteneur entier. Cela évite la guerre de réconciliation React ↔ ProseMirror (curseur qui saute, caractères perdus). Ce pattern n'a pas été nécessaire jusqu'ici, les NodeViews restant en DOM impératif.

**Non concerné — marks et decorations.** `didascalie`, la marque `highlight`, `word-highlight` n'ont pas de NodeView : leur rendu passe par `toDOM` (marks) ou des `Decoration` à base de classes. Leur visuel est déjà 100 % CSS, donc déjà trivial à restyler — rien à migrer.

---

## Correcteur orthographique (`src/shared/plugins/spellcheck/`)

Correcteur local (français, hors-ligne) basé sur le plugin Tauri **Hugo** (`hugoApi.ts`, commande `plugin:hugo-tauri|check_text`). Côté frontend, un plugin ProseMirror (`spellcheckPlugin.ts`) gère le soulignage et l'orchestration.

### Vérification incrémentale par blocs

Deux `DecorationSet` cohabitent dans l'état du plugin :
- **`decos`** — soulignages visibles (`Decoration.inline` avec classe `hugo-spell` / `hugo-grammar`), porteurs de la suggestion Hugo dans `spec.suggestion`.
- **`dirty`** — décorations *invisibles* alignées par textblock, marquant les blocs à (re)vérifier. Alignées par bloc → consommables un bloc à la fois.

À chaque édition, `changedRange(tr)` calcule la plage modifiée (en coordonnées du doc final, en traversant les `mapping.maps`), retire les soulignages périmés qui la chevauchent, et marque les blocs concernés `dirty`. Un **worker** (`runWorker`) vérifie ensuite les blocs dirty **par lots** (`BATCH_SIZE = 8`), **viewport d'abord** (`dirtyBlocks` trie les blocs visibles en tête via `viewportRange`), en rendant la main à l'UI entre chaque lot (`setTimeout(…, 0)`). Debounce de `DEBOUNCE_MS = 250` ; un flag `running` empêche la concurrence. La commande Hugo est **async** : un appel synchrone gèlerait l'UI (cf. mémoire projet).

### Mapping offsets octets ↔ positions ProseMirror

Hugo renvoie des offsets en **octets UTF-8**. `decorateBlock` parcourt le textblock une fois en construisant en parallèle :
- `byteToPos[]` : octet → position ProseMirror (pour placer les décorations),
- `byteToChar[]` : octet → index dans la chaîne `text` envoyée (pour extraire le mot fautif, cf. mots ignorés).

`utf8Len(codePoint)` donne la taille en octets d'un point de code ; `ch.length` (UTF-16) est la taille côté PM/JS. Une sentinelle en fin de table couvre la position du dernier caractère.

### Scan à l'ouverture (et non « à la frappe »)

Le plugin marque **tout le document `dirty` dans son `init`**, mais le déclenchement du worker se fait depuis `view().update()` — **or ProseMirror n'appelle pas `update()` pour l'état initial**, uniquement sur les transactions suivantes. Sans correctif, le scan ne démarrait donc qu'à la première frappe. Le scan initial est amorcé dans **le corps de `view(editorView)`** (appelé une fois à la création de la vue). Comme `<MilkdownProvider key={activeNote.id}>` remonte l'éditeur à chaque note, l'`init` + cet amorçage rejouent à chaque ouverture.

### Refs module-level partagées

Le plugin ProseMirror est créé une seule fois ; React communique avec lui via des refs module-level dans `spellcheckState.ts` (même pattern que `highlight/defaultColorRef`) :
- `spellcheckEnabledRef` — lu à chaque update pour activer/nettoyer (synchronisé depuis `spellcheckEnabledAtom`).
- `spellSuggestionCallbackRef` — callback `handleClick` → popover React.
- `ignoredWordsRef` — `Set` des mots ignorés (en minuscules).

Les changements de réglage passent par des métas de transaction : `{ dirtyAll: true }` (tout re-vérifier) ou `{ clear: true }` (désactivation).

### Mots ignorés (par vault)

Stockés dans `.lueurs/config.json` (champ `ignoredWords: string[]`, cf. `vaultConfig.ts`) — pas de fichier séparé : la liste reste légère et voyage avec la config via iCloud. Accès via `ignoredWordsAtom` (lecture, dérivé de `vaultConfigAtom`) et `updateIgnoredWordsAtom` (write atom async : persiste + met à jour l'atom).

- **Filtrage** : dans `decorateBlock`, une suggestion d'**orthographe** dont le mot (`text.slice(byteToChar…)`, en minuscules) est dans `ignoredWordsRef` est ignorée. La grammaire n'est pas filtrée (suggestions multi-mots).
- **Synchronisation** : `MarkdownEditor` alimente `ignoredWordsRef` avant le scan initial (timing OK : le ref est posé dans un `useEffect`, bien avant le debounce de 250 ms) et redéclenche `dirtyAll` à chaque changement de la liste (ajout via popover, retrait via réglages).
- **Ajout** : action « Ignorer ce mot » du popover (orthographe uniquement). **Gestion** : `IgnoredWordsView` (onglet *Éditeur* des réglages) — vue dédiée, liste triée + recherche, **suppression seule**.

### Popover de suggestions

`SpellSuggestionPopover.tsx` est positionné en coordonnées **écran** (`view.coordsAtPos`) avec `position: fixed`. Comme ces coordonnées sont figées, il se **ferme au scroll** (listener `scroll` en capture, pour attraper n'importe quel conteneur scrollable), au clic extérieur et à Échap — plutôt que de le repositionner en continu.

---

## Export PDF / Aperçu Typst

### Vue d'ensemble

Typst est embarqué comme crates Rust (`typst`, `typst-layout`, `typst-pdf`, `typst-svg` 0.15.0) — aucun binaire externe, aucune dépendance système. Le trait `typst::World` est implémenté par `LueursWorld` (`src-tauri/src/typst_export.rs`).

Deux pipelines distincts :

| | Aperçu live | Export PDF |
|---|---|---|
| Format | SVG page par page | PDF complet |
| Rendu | `typst_svg::svg()` | `typst_pdf::pdf()` |
| Architecture | Thread dédié + événements Tauri | `spawn_blocking` |
| World | Singleton réutilisé (comemo) | Nouveau world par appel |
| Latence | Quasi-nulle (fire-and-forget) | Acceptable (action explicite) |

### Architecture aperçu : thread dédié

L'aperçu live est traité par un thread dédié `"typst-compiler"` avec une boîte aux lettres `Mutex<Option<DemandeApercu>> + Condvar`. Ce pattern est identique à celui de tinymist (le serveur LSP Typst utilisé par l'extension VSCode).

**Pourquoi un thread dédié et non `spawn_blocking` ?**

Avec `spawn_blocking`, chaque changement d'option dépose une tâche dans le pool Tokio. Si l'utilisateur modifie plusieurs options rapidement, les compilations se mettent en file — chaque version intermédiaire compile et émet ses résultats, avec un délai cumulatif. Le thread dédié résout cela : si une nouvelle requête arrive pendant une compilation, elle **remplace** la demande en attente dans la boîte. Seule la dernière option choisie est compilée. Les intermédiaires sont silencieusement jetés.

```
Frontend          Boîte aux lettres          Thread typst-compiler
   │                    │                           │
   │──── requête 1 ────▶│         (dormait)         │
   │                    │──────── réveil ───────────▶│ compile…
   │──── requête 2 ────▶│ (remplace requête 1)       │
   │──── requête 3 ────▶│ (remplace requête 2)       │
   │                    │              ◀──── fini ───│ émet résultat 1
   │                    │──────── réveil ───────────▶│ compile requête 3
```

**Structs Rust :**

```rust
struct DemandeApercu { contenu: String, request_id: u64, app: tauri::AppHandle }

#[derive(Serialize, Clone)]
struct ApercuPage { request_id: u64, page_idx: usize, total: usize, svg: String }

#[derive(Serialize, Clone)]
struct ApercuErreur { request_id: u64, message: String }

static BOITE: OnceLock<(Mutex<Option<DemandeApercu>>, Condvar)> = OnceLock::new();
```

### Compilation incrémentale via `Source::replace()` et comemo

Le `LueursWorld` singleton **vit dans le thread** (pas de Mutex de compilation). Entre deux requêtes, son contenu est mis à jour via `self.source.replace(contenu)` — cette méthode modifie la source en place tout en préservant le `FileId`. comemo peut donc corréler compilations successives et réutiliser les mises en page inchangées.

```rust
fn mettre_a_jour(&mut self, contenu: &str) {
    self.source.replace(contenu); // préserve FileId → comemo garde le cache
}
```

`comemo::evict(30)` est appelé après chaque compilation pour purger les entrées de cache inutilisées au-delà de 30 requêtes, évitant une croissance mémoire illimitée.

### Optimisation des dépendances en mode dev

Les crates Typst sont écrites pour la performance (`typst-layout`, `typst-svg`, comemo font du calcul intensif). Sans optimisation, le build debug est 10 à 50× plus lent que le release, rendant l'aperçu live inutilisable.

```toml
# Cargo.toml – pattern identique au repo typst officiel
[profile.dev.package."*"]
opt-level = 2
```

Cette option compile **toutes les dépendances** (mais pas le code de l'app elle-même) avec `opt-level = 2` en mode debug. Le code de l'app reste en `opt-level = 0` (recompilation rapide, meilleur débogage).

### Cache SVG

Un second `OnceLock` stocke le dernier résultat de compilation `(hash_source → Vec<String> base64)`. Si le même source Typst est redemandé (ex : l'utilisateur ferme et rouvre le dialogue), les pages sont réémises instantanément sans recompilation.

```rust
static CACHE_SVG: OnceLock<Mutex<Option<(u64, Vec<String>)>>> = OnceLock::new();
```

### Polices embarquées

Les polices sont compilées dans le binaire via `include_bytes!()` :

- **`typst-assets` (feature `fonts`)** — DejaVu Sans Mono, Libertinus Serif, New Computer Modern.
- **`src-tauri/fonts/`** — Inter Variable (×2, upright + italic, ~860 KB chacun) et EB Garamond Variable (×2, ~875 KB chacun).

Total embarqué : ~3,5 MB. Élimine tout scan de polices système.

### Caches statiques (`OnceLock`)

```rust
static POLICES:   OnceLock<Vec<Font>>                   // parsing des TTF
static LIVRE:     OnceLock<Arc<LazyHash<FontBook>>>     // index de correspondance polices
static LIBRAIRIE: OnceLock<Arc<LazyHash<Library>>>      // bibliothèque standard Typst
```

`Library::builder().build()` initialise tous les types, fonctions et modules Typst intégrés (~100-300 ms au premier appel). `FontBook::from_fonts()` construit l'index de correspondance. Les deux sont partagés via `Arc::clone()` (O(1)).

### Préchauffage au démarrage

```rust
// lib.rs – setup()
std::thread::spawn(prechauffer);
```

`prechauffer()` initialise les trois `OnceLock`, la boîte aux lettres, et **démarre le thread `"typst-compiler"`**. Quand l'utilisateur ouvre le dialogue d'export pour la première fois, le thread tourne déjà et les caches sont chauds.

### Émission SVG page par page

Le thread émet un événement Tauri `"apercu_page"` dès que chaque page est rendue. La page 1 est visible avant que les pages suivantes finissent de compiler. Le SVG est encodé en base64 car les événements Tauri sérialisent en JSON.

```rust
// Requiert use tauri::Emitter; dans les imports — méthode en trait, pas sur le type direct
let svg = typst_svg::svg(page, &SvgOptions::default());
let b64 = base64::engine::general_purpose::STANDARD.encode(svg.as_bytes());
app.emit("apercu_page", ApercuPage { request_id, page_idx: i, total, svg: b64 });
```

### API frontend (fire-and-forget + requestIdRef)

`compiler_typst_apercu` dépose la demande dans la boîte et retourne immédiatement (`Ok(())`). Le frontend n'attend pas le résultat de l'`invoke` — les pages arrivent via les event listeners.

```typescript
// Un compteur monotone, comparé dans les événements pour ignorer les résultats périmés
const requestIdRef = useRef(0);

function compilerApercu() {
    const id = ++requestIdRef.current;
    setRecompilation(true);
    invoke("compiler_typst_apercu", { contenuTypst: typst, requestId: id })
        .catch((e) => { if (id === requestIdRef.current) setErreur(String(e)); });
}
```

Les listeners `"apercu_page"` et `"apercu_erreur"` sont installés une seule fois au montage du composant. Si `payload.request_id !== requestIdRef.current`, l'événement est ignoré — les résultats d'une compilation annulée ne corrompent pas l'affichage.

L'état `pages: (string | null)[]` représente les pages reçues. Les pages null (pas encore reçues) s'affichent en placeholder A4. Les anciennes pages restent visibles à `opacity-40` pendant la recompilation. Il n'y a **pas de debounce** sur les changements d'options : la commande retournant instantanément, chaque interaction déclenche un envoi sans coût côté JS. C'est le thread Rust qui absorbe les rafales via la boîte aux lettres.

### Conversion ProseMirror → Typst (`proseToTypst.ts`)

`proseMirrorDocVersTypst(doc, titre, vaultPath, opts)` traverse le document ProseMirror et génère un source Typst complet. Deux parties :

1. **En-tête** (`construireEnteteTypst`) — `#set page`, `#set text`, `#set par`, `#show heading`, `#show raw`, définitions de `blockquote`, `poetry`, `didascalie`, `hl`.
2. **Corps** — `convertirBloc()` traite les nœuds de premier niveau, `convertirInlines()` traite les contenus inline, `appliquerMarks()` enveloppe le texte dans les fonctions Typst correspondantes.

**Listes à puces.** Le marqueur est piloté par la police choisie :
```typst
#set list(marker: ([•], [◦], [–]))  // Inter
#set list(marker: ([–], [·], [·]))  // Garamond
```

**Hiérarchie des titres** (H1 à H6, taille décroissante, sans ligne séparatrice) :
```
H1 : 1.6em bold       H2 : 1.3em bold
H3 : 1.15em semibold  H4 : 1.05em semibold italic
H5 : 1em italic       H6 : 0.9em luma(100)
```
La ligne horizontale sous H1 (`#line(length: 100%)`) a été retirée — elle créait une rupture visuelle trop forte.

### Sauts de page intelligents

Un `#pagebreak(weak: true)` est inséré avant un titre de niveau L si :
1. `niveauNouvellePage >= L` (activé dans les options),
2. il existe un bloc précédent dans le document, et
3. le bloc précédent n'est **pas** un titre de niveau strictement inférieur à L (titre parent).

Condition 3 : évite le saut entre H1 et son H2 immédiat. `prevNode` est tracké dans la boucle `doc.forEach()` et transmis à `convertirBloc()`.

### Export PDF final

L'export PDF utilise un `spawn_blocking` indépendant (latence acceptable pour une action explicite). Il crée un nouveau `LueursWorld` et ne partage pas le cache comemo avec le thread d'aperçu — les deux ne s'interfèrent pas.

### Limitation connue

**Pas d'images dans le PDF** : `LueursWorld::file()` retourne toujours `FileError::NotFound`. Les médias du vault ne sont pas accessibles depuis le contexte Typst. P2.

---

## Choix de conception

**Stockage YAML plat.** Les propriétés système utilisent des clés avec doubles tirets bas (`__Type__`, `__Template__`, etc.) pour éviter les collisions avec les propriétés utilisateur tout en restant lisibles dans n'importe quel éditeur Markdown.

**Propagation via Rust.** Le traitement parallèle des fichiers à la modification d'un template est difficile à faire de manière fiable depuis le frontend (contraintes du FS scope Tauri, concurrence JS single-thread). Rust gère cela proprement avec Tokio et `JoinSet`.

**Local-first.** Aucune donnée ne quitte la machine. Le vault est un dossier de fichiers `.md` standard, modifiable depuis n'importe quel éditeur externe (Obsidian, VS Code, etc.). Lueurs détecte les changements externes via le watcher FS et réconcilie son état.

**Pointer events pour le D&D interne.** HTML5 DnD est inutilisable dans Tauri/WKWebView sur macOS (interception OS). Les pointer events contournent ce problème proprement car ils ne passent pas par le mécanisme de drag OS.