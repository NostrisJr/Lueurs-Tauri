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

### Propagation après déplacement

`handleInternalDrop` appelle `moveNode` (renommage FS), puis `propagateNoteRename` ou `propagateFolderRename` pour mettre à jour toutes les références dans le vault. Si la note active fait partie du sous-arbre déplacé, `activeNoteIdAtom` est mis à jour avec le nouveau chemin.

---

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

`computeTemplateProps` (`fileTreeHelpers.ts`) calcule les propriétés qu'une note doit recevoir d'après ses templates. Elle distingue propriétés imposées (valeur non vide dans le template) et contraignantes (valeur vide), et ne modifie jamais une valeur déjà renseignée par la note pour une propriété contraignante.

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

## Choix de conception

**Stockage YAML plat.** Les propriétés système utilisent des clés avec doubles tirets bas (`__Type__`, `__Template__`, etc.) pour éviter les collisions avec les propriétés utilisateur tout en restant lisibles dans n'importe quel éditeur Markdown.

**Propagation via Rust.** Le traitement parallèle des fichiers à la modification d'un template est difficile à faire de manière fiable depuis le frontend (contraintes du FS scope Tauri, concurrence JS single-thread). Rust gère cela proprement avec Tokio et `JoinSet`.

**Local-first.** Aucune donnée ne quitte la machine. Le vault est un dossier de fichiers `.md` standard, modifiable depuis n'importe quel éditeur externe (Obsidian, VS Code, etc.). Lueurs détecte les changements externes via le watcher FS et réconcilie son état.

**Pointer events pour le D&D interne.** HTML5 DnD est inutilisable dans Tauri/WKWebView sur macOS (interception OS). Les pointer events contournent ce problème proprement car ils ne passent pas par le mécanisme de drag OS.