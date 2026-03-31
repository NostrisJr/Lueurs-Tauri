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

## Choix de conception

**Stockage YAML plat.** Les propriétés système utilisent des clés avec doubles tirets bas (`__Type__`, `__Template__`, etc.) pour éviter les collisions avec les propriétés utilisateur tout en restant lisibles dans n'importe quel éditeur Markdown.

**Propagation via Rust.** Le traitement parallèle des fichiers à la modification d'un template est difficile à faire de manière fiable depuis le frontend (contraintes du FS scope Tauri, concurrence JS single-thread). Rust gère cela proprement avec Tokio et `JoinSet`.

**Local-first.** Aucune donnée ne quitte la machine. Le vault est un dossier de fichiers `.md` standard, modifiable depuis n'importe quel éditeur externe (Obsidian, VS Code, etc.). Lueurs détecte les changements externes via le watcher FS et réconcilie son état.

**Pointer events pour le D&D interne.** HTML5 DnD est inutilisable dans Tauri/WKWebView sur macOS (interception OS). Les pointer events contournent ce problème proprement car ils ne passent pas par le mécanisme de drag OS.
