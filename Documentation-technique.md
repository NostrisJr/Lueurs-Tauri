# Lueurs — Documentation technique

## Architecture générale

Lueurs est une application desktop construite avec **Tauri 2** (Rust + WKWebView) et **React** côté frontend. Les notes sont des fichiers `.md` stockés dans un dossier vault choisi par l'utilisateur. Toute la persistance est locale : pas de serveur, pas de base de données.

### État global (Jotai)

L'état de l'application est géré par des atomes Jotai (`src/lib/atoms.ts`) :

- `treeAtom` — l'arbre complet du vault (source de vérité pour les données des notes)
- `activeNoteIdAtom` — chemin de la note ouverte
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
    let outer = window.outer_position().unwrap_or_default(); // frame fenêtre
    let inner = window.inner_position().unwrap_or_default(); // viewport WebView
    (inner.y - outer.y) as f64
}
```

Côté JS, les coordonnées raw du drop sont corrigées :

```ts
const cssX = rawX / dpr;
const cssY = (rawY + titlebarPhysical) / dpr; // + car wry a soustrait le titlebar en trop
```

Le signe est `+titlebar` (pas `-`) car wry soustrait déjà l'offset title bar lors de la conversion macOS → CSS, créant un décalage négatif qu'il faut compenser. Ces valeurs sont ensuite passées à `document.elementFromPoint` pour identifier le dossier cible.

L'offset est mis en cache après le premier drop (un seul `invoke` Rust pour la durée de vie de l'application).

---

## Propagation de templates (Rust)

Lorsque le frontmatter d'un template change, le frontend (`useTemplateSync`) calcule la liste des notes héritières et invoque `propagate_template_change`. Rust traite les fichiers en parallèle (Tokio `JoinSet`) et les écrit directement sur le disque.

La commande reçoit un `TemplateChange` :

- `addProp` — ajoute la propriété si absente
- `removeProp` — supprime la propriété
- `renameProp { old_key, new_key, template_value }` — renomme avec résolution de conflit
- `forceValue` — impose une valeur

Pour le renommage, Rust parse le frontmatter YAML, détecte si `new_key` est déjà présent (conflit), et applique la règle : valeur du template si propriété imposée ; pour une propriété contraignante, la valeur de `old_key` prime si non vide (prop héritée > prop personnalisée), sinon la valeur existante de `new_key` est conservée.

### Résolution des propriétés template (frontend)

`computeTemplateProps` (`fileTreeHelpers.ts`) calcule les propriétés qu'une note doit recevoir d'après ses templates. Elle distingue propriétés imposées (valeur non vide dans le template) et contraignantes (valeur vide), et ne modifie jamais une valeur déjà renseignée par la note pour une propriété contraignante.

---

## Choix de conception

**Stockage YAML plat.** Les propriétés système utilisent des clés avec doubles tirets bas (`__Type__`, `__Template__`, etc.) pour éviter les collisions avec les propriétés utilisateur tout en restant lisibles dans n'importe quel éditeur Markdown.

**Propagation via Rust.** Le traitement parallèle des fichiers à la modification d'un template est difficile à faire de manière fiable depuis le frontend (contraintes du FS scope Tauri, concurrence JS single-thread). Rust gère cela proprement avec Tokio et `JoinSet`.

**Local-first.** Aucune donnée ne quitte la machine. Le vault est un dossier de fichiers `.md` standard, modifiable depuis n'importe quel éditeur externe (Obsidian, VS Code, etc.). Lueurs détecte les changements externes via le watcher FS et réconcilie son état.

**Pointer events pour le D&D interne.** HTML5 DnD est inutilisable dans Tauri/WKWebView sur macOS (interception OS). Les pointer events contournent ce problème proprement car ils ne passent pas par le mécanisme de drag OS.
