# Audit du code front — Lueurs

> Périmètre : `src/` (TS/TSX) — desktop + mobile + shared + plugins. Rust hors périmètre.
> Date : 2026-05-20. Tri : par sévérité décroissante.
>
> Légende sévérité :
> - **C** — Critique : bug, fuite, race, données corruptibles
> - **A** — Architecture / inefficacité notable
> - **M** — Code mort, dette
> - **S** — Style / mauvaise pratique React, sans impact direct

---

## 1. Critiques (à traiter en priorité)

### C1 — `useFileTree()` est instancié 14 fois ; chaque instance a son propre debounceTimers Map
**Sévérité : Critique — risque de corruption d'écriture, race conditions.**
- `src/shared/hooks/useFileTree.ts:104-110` — `debounceTimers = useRef(new Map())` et `unwatchRef`, `reloadTimer` sont locaux au hook.
- 14 sites d'appel : `useNote.ts:50`, `DesktopApp:24`, `SideBarResizable:35`, `SettingsModal:35`, `FileNode:140`, `BaseView:33`, `useFileDrop:135`, `MobileApp:49`, `MobileSettingsView:28`, `MobileFileTree:75`, `FileTreeHeader:38`, `MobileBaseView:24`, `MobileDictaphone:58` (+ la définition).
- Conséquence concrète : `useNote.handleChange` → `updateNote(fileId, ...)` côté instance A. Si `MobileDictaphone` ou un autre composant appelle aussi `updateNote(fileId, ...)` côté instance B (sa propre instance de `useFileTree`), il n'y a **aucune coordination de debounce entre A et B** : deux timers indépendants peuvent écrire la même note dans un ordre indéterminé.
- Autre conséquence : chaque instance définit son `unwatchRef`, mais seules les instances qui appellent `startWatcher` (DesktopApp, MobileApp) attachent un watcher → OK pour ce point précis, mais l'inverse n'est pas vrai pour `debounceTimers`.

**Recommandation** : extraire `debounceTimers`, `reloadTimer`, `unwatchRef`, `writingPathsRegistry` en singletons module-level (comme l'est déjà `writingPathsRegistry`), ou exposer `useFileTree` via un contexte React unique avec instance singleton. Variante plus radicale : `useFileTree` ne devrait exposer que des `useCallback` stables wrappant des fonctions module-level, l'état mutable étant porté par le module.

---

### C2 — `useEffect` de scroll dupliqué dans `MobileEditor` (race condition probable)
- `src/mobile/components/Editor/MobileEditor.tsx:93-112` — deux `useEffect` séparés qui touchent tous les deux `container.scrollTop` quand le clavier change. Sous 16 ms, deux scrolls successifs peuvent se contredire.

**Recommandation** : fusionner en un seul effet `[keyboardHeight, activeNote?.id]` qui dérive le `scrollTop` cible une seule fois.

---

### C3 — `_globalDesktopStop` (audio-block) survit au démontage du composant
- `src/shared/plugins/audio-block/AudioBlockComponent.tsx:34` — `let _globalDesktopStop` module-level.
- `node-view.ts:97-101` — `destroy()` du NodeView unmounte React mais ne nettoie **pas** `_globalDesktopStop`. Si l'utilisateur change de note pendant la lecture audio, le composant React est unmount, ses refs deviennent invalides, mais `_globalDesktopStop` peut encore pointer vers la closure de `stopDesktopPlayback()` — appelée au prochain play d'un autre bloc, elle touche des refs nullifiées.

**Recommandation** : ajouter au `destroy()` du NodeView un check `if (_globalDesktopStop === maStopFn) _globalDesktopStop = null`. Ou mieux : remonter la coordination dans un module avec un Set d'`unsubscribe`, et désinscrire dans le destroy.

---

### C4 — Fuite de listener `keydown` dans `FileTreeHeader` mobile
- `src/mobile/components/FileTree/FileTreeHeader.tsx:75-84` — le listener `mousedown` attaché à `document` n'est retiré que si `showMenu` repasse à `false`. Si le composant se démonte alors que `showMenu === true`, le listener reste actif.

**Recommandation** : cleanup systématique dans le return du `useEffect`.

---

### C5 — `contentEditable` posé sur un `<input>` dans `SearchView`
- `src/mobile/components/Search/SearchView.tsx:81` — `contentEditable` n'est pas valide sur `<input>` (ignoré silencieusement). Le champ marche pour la mauvaise raison (`value`/`onChange` font le boulot).

**Recommandation** : supprimer l'attribut.

---

### C6 — `FloatingInput` est un composant inachevé / mort
- `src/mobile/components/Floating/FloatingInput.tsx:19` — déclare 7 props, n'en utilise que 2 (`onClose`, `label`) ; **l'`<input>` n'existe même pas dans le rendu** — le composant ne fait rien d'utile. Aucune import externe trouvée (`grep` confirme zéro consommateur hors du fichier lui-même).

**Recommandation** : supprimer le fichier, ou compléter l'implémentation si elle était prévue.

---

### C7 — Hooks clavier morts : `useKeyboardVisible`, `useKeyboardOffset`
- `src/mobile/hooks/useKeyboardVisible.ts` et `useKeyboardOffset.ts` — exportés mais aucun consommateur hors de leur fichier (`grep` confirme). `useKeyboardOffset` duplique en plus la logique de `useKeyboardHeight`.

**Recommandation** : supprimer ; les besoins sont couverts par `useKeyboardHeight` et `useAndroidKeyboardOpen`.

---

### C8 — `flattenTree` recalculé à chaque render de chaque ligne de tableau
- `src/desktop/components/BaseView/TableView/TableRow.tsx:28` — `flattenTree(useAtomValue(treeAtom))` sans `useMemo`. Pour une base avec N enfants → N×|tree| nœuds parcourus à chaque render.
- `src/mobile/components/BaseView/TableView/MobileTableRow.tsx:28` — même problème.
- `src/desktop/components/BaseView/TableView/TableCell.tsx:56-59` — `notesByName` Map recréée par cellule (N × M Maps pour N lignes × M colonnes).
- `src/desktop/components/Frontmatter/FrontmatterRow.tsx:159` — `noteResolver` recréé à chaque render, casse la stabilité des deps en aval.

**Recommandation** : calculer `allNotes` (et `notesByName`) au niveau de `TableView`/`MobileTableView`/`FrontmatterEditor` une seule fois, les passer en prop ou via un atom dérivé `allNotesAtom` mémoïsé.

---

### C9 — `activeNoteAtom` traverse tout l'arbre à chaque lecture
- `src/shared/lib/Atoms.ts:131-135` — `activeNoteAtom` fait `flattenTree(get(treeAtom)).find(n => n.id === id)` à chaque accès. Comme cet atom est très lu (par `useNote`, `NoteEditor`, `FrontmatterEditor`, etc.), chaque changement de tree → flatten complet pour chaque consommateur. Idem `kanbanCardsAtom` (`Atoms.ts:247`).

**Recommandation** : créer un `notesByIdAtom = atom(get => new Map(flattenTree(get(treeAtom)).map(n => [n.id, n])))` et faire dériver `activeNoteAtom` et les autres consommateurs depuis cette Map (lookup O(1)).

---

### C10 — `nativeSubscribe` ne garantit pas qu'un seul subscriber existe par bloc
- `src/shared/lib/nativeAudioPlayer.ts:35-117` — `subscribers = new Map<string, StateCallback>()`. Si plusieurs blocs audio partagent un `nodeId` (peu probable mais pas garanti, le compteur `_nodeCounter` de `node-view.ts:13` est module-level → renouvelé si l'app se recharge), le second écrase silencieusement le premier.
- Aussi : `displaceActive` (ligne 41) appelle l'`IDLE_STATE` du subscriber sortant — si ce subscriber a été remplacé entre-temps, on notifie un autre composant.

**Recommandation** : utiliser un `WeakRef` ou un Set de callbacks par `nodeId`. Et stabiliser `_nodeCounter` par fichier+pos ProseMirror plutôt qu'un compteur global.

---

### C11 — `useFrontmatter.handleChange` compare via `JSON.stringify` (ordre des clés)
- `src/shared/hooks/useNote.ts:67` — `JSON.stringify(frontmatter) !== JSON.stringify(activeNote.frontmatter)`. Sensible à l'ordre d'insertion des clés. Si une opération recompose le frontmatter dans un autre ordre (ex. après applyTemplateProps qui spread `...updated` puis ajoute), on détecte une fausse modification → re-déclenche `onFrontmatterChange` → recalcul propagation, écriture inutile, race avec le debounce.

**Recommandation** : comparer par clés triées, ou maintenir un hash stable, ou comparer champ par champ.

---

## 2. Architecture & inefficacités

### A1 — Tous les listeners DOM de NodeView (`task-list`, `heading-fold`) survivent à la reconstruction
- `src/shared/plugins/task-list/taskListPlugin.ts:55,70` — `addEventListener("change", ...)` et `addEventListener("touchstart", ...)` sur la checkbox ; aucun `destroy()` du NodeView ne les retire.
- `src/shared/plugins/heading-fold/headingNodeView.ts:64-133` — `btn.addEventListener("touchstart", ..., { passive:false })` + `mousedown` ; aucun cleanup.
- Conséquence : à chaque reconstruction du nœud (édition lourde, refold), nouveaux listeners s'accumulent sur des nœuds DOM en réutilisation potentielle.

**Recommandation** : ajouter un `destroy()` qui sauvegarde les références et fait `removeEventListener`.

---

### A2 — `applyAllTemplates` re-écrit tous les fichiers modifiés à chaque chargement initial
- `src/shared/lib/vaultIO.ts:317-396` — au chargement du vault, parcourt toutes les notes, applique les templates, et **écrit sur disque** les notes modifiées avant même que l'UI ne soit montée. Conséquences :
  - **Premier démarrage perçu comme lent** (Promise.all écriture sur disque).
  - Le `__Type__` injecté automatiquement (`vaultIO.ts:294-299`) est aussi persisté lors du load — encore une écriture. Combiné avec `applyAllTemplates`, chaque démarrage écrit tout fichier qui n'avait pas son `__Type__`.
- Plus subtil : `applyAllTemplates` n'utilise pas `writingPathsRegistry` → si le watcher est déjà démarré (cas atypique), les writes peuvent déclencher un rechargement boucle.

**Recommandation** : marquer ces writes via `writingPathsRegistry`, et n'écrire que si réellement nécessaire (ne pas écrire un nœud quand le seul changement est l'inférence de `__Type__` lors d'une simple visite).

---

### A3 — `useTemplateSync.resolveAllHeirs` et `resolveHeirBases` sont O(n²) par propagation
- `src/desktop/hooks/useTemplateSync.ts:319-347` — chaque appel re-flattenTree puis filtre. `propagate()` appelle `resolveAllHeirs` une fois et chaque appel à `renameTemplateProperty` puis les `for (const base of resolveHeirBases(...))` itèrent à nouveau.

**Recommandation** : cacher la résolution dans une variable locale partagée entre les helpers d'un même cycle. Idéalement, indexer une fois `allNotes` par template id.

---

### A4 — `kanbanCardsAtom` recompute lourd à chaque changement de tree
- `src/shared/lib/Atoms.ts:235-281` — `kanbanCardsAtom` fait `flattenTree(get(treeAtom))` puis `.find(...)` par child path. Pour une base avec K enfants × |tree| nœuds → O(K·N).
- Recomputé à chaque modification d'une note (frappe au clavier en parallèle d'un kanban ouvert).

**Recommandation** : voir C9 (indexer par id), et limiter le recompute aux changements qui affectent réellement la base active (children, frontmatter de la base, frontmatter des children).

---

### A5 — Logique `handleSelectNote`/onglet répétée 4 fois
- `src/shared/hooks/useNote.ts:104-149` — `handleSelectNote` et `handleOpenFolder` dupliquent le même if/else pour la gestion onglets (4 cas identiques).

**Recommandation** : extraire `function openInTab(noteId: string, openInNewTab: boolean)` réutilisable.

---

### A6 — `arraysEqual` trie deux arrays à chaque appel
- `src/desktop/components/Frontmatter/hooks/useFrontmatter.ts:22-27` — `[...a].sort()` + `.every`. O(n log n) inutile.

**Recommandation** : `const sb = new Set(b); return a.length === b.length && a.every(v => sb.has(v))`.

---

### A7 — `rowsAtom` (derived) fait `JSON.stringify` à chaque lecture
- `src/desktop/components/Frontmatter/lib/frontMatterAtoms.ts:9-47` — derived atom qui :
  - sérialise chaque champ système pour les comparer,
  - compare les ensembles de clés,
  - compare valeur par valeur.
  Appelé à chaque render de `FrontmatterEditor` et de chaque `FrontmatterRow` (via setRows).

**Recommandation** : comparer les références ou comparer key-set + key-value sans `JSON.stringify`. Et n'invalider l'override que sur les vrais signaux (id de note change, ou frontmatter externe diffère via un hash de contenu).

---

### A8 — `toArray()` redéfini partout
- Présent dans `fileTreeHelpers.ts` (canonique) et redéfini/dupliqué dans `useTemplateConstraints.ts:8-12`, `usePathPropagation.ts:11`, `useFrontmatter.ts:84`, etc. Helpers de string→array similaires.

**Recommandation** : un seul `toArray` exporté depuis `fileTreeHelpers.ts`, supprimer les copies.

---

### A9 — `REF_PROP_TRIGGER_RE` et `getNoteProperties` dupliqués entre TableCell et FrontmatterValue
- `src/desktop/components/BaseView/TableView/TableCell.tsx:20-25` ≈ `src/desktop/components/Frontmatter/FrontmatterValue.tsx:33-39` (au moins).

**Recommandation** : extraire dans `src/desktop/components/Frontmatter/lib/frontmatterUtils.ts` (déjà présent).

---

### A10 — `vaultDisplayName` dupliquée mobile
- `src/mobile/components/FileTree/FileTreeHeader.tsx:23-30` ≈ `src/mobile/components/Settings/MobileSettingsView.tsx:11-15`.

**Recommandation** : extraire dans `src/mobile/lib/vault.ts`.

---

### A11 — Animation push/swipe dupliquée (MobileApp + MobileFileTree)
- `src/mobile/MobileApp.tsx:75-159` (push horizontal entre vues) et `src/mobile/components/FileTree/MobileFileTree.tsx:137-159` (drill-in dans les dossiers) implémentent deux fois le même cycle "initial / animating / cleanup" avec rAF + setTimeout.

**Recommandation** : extraire un hook `usePushAnimation(condition, duration)` qui retourne `{ phase, from, isPushing }`.

---

### A12 — Cycle de vie de `WaveformDisplay` re-attache les listeners à chaque changement de `color`
- `src/shared/components/Dictaphone/WaveformDisplay.tsx:153` — `useEffect(..., [isActive, width, height, color])`. La couleur change rarement, mais quand elle change (toggle pill/sheet), l'effet :
  1. Décroche le listener Tauri,
  2. Le reproduit après un `await invoke(...)`,
  3. Pendant ce await, des `dirtyRef.current` peuvent être ratés.
- En bonus, `cancelListener` est assigné après l'await (`WaveformDisplay.tsx:131-145`) — si le composant unmounts pendant l'await, le cleanup return ne voit pas encore `cancelListener` → fuite.

**Recommandation** : séparer en deux effets : (1) `[isActive]` pour register/unregister listener, (2) `[width, height, color]` pour resize/repaint. Stocker `cancelListener` dans un ref synchrone.

---

### A13 — Heuristique fragile `","` pour décider array dans frontmatter
- `src/desktop/components/Frontmatter/lib/frontmatterUtils.ts:41-46` — `toFrontmatter` splitte sur `,` toute valeur contenant une virgule. Si l'utilisateur tape `"Pomme, poire"` comme valeur scalaire, elle devient un array.

**Recommandation** : utiliser `row.isNoteArray` (déjà présent dans `Row`) pour décider, sans heuristique sur la valeur.

---

### A14 — `displayMode` dans `NoteEditor` synchronisé via `useEffect` au lieu d'un atom dérivé
- `src/shared/components/NoteEditor/NoteEditor.tsx:60-71` — `useEffect` qui lit `activeNote.frontmatter.__DisplayMode__` et fait `setDisplayMode`. C'est un cas classique : un atom dérivé éliminerait l'effet entièrement.

**Recommandation** : remplacer `displayModeAtom` par un atom dérivé qui lit `activeNoteAtom` et `defaultDisplayModeAtom`. La consommation reste identique.

---

### A15 — `documentMapAtom` vidé via `useEffect` quand on passe sur une base
- `src/shared/components/NoteEditor/NoteEditor.tsx:55-57` — pareil que A14, un effet pour "vider l'atom quand le contexte change". Un atom dérivé `documentMapForActiveAtom = activeIsBase ? empty : documentMapAtom` rendrait l'effet inutile.

---

### A16 — Listener `getCurrentWebview().onDragDropEvent` enregistré au niveau module dans `MarkdownEditor`
- `src/shared/components/NoteEditor/MarkdownEditor.tsx:196-211` — l'enregistrement se fait dès l'import du module, hors de tout React lifecycle. `dropHandlerRef.current` est ensuite muté par `useDropHandler`. C'est volontaire (singleton) mais a deux conséquences :
  - L'enregistrement s'exécute même si `MarkdownEditor` n'est jamais monté.
  - La Promise n'est jamais cleanup (impossible : pas de désabonnement) ; vit toute la session.

**Recommandation** : déplacer l'enregistrement dans un `useEffect([])` du `MarkdownEditor` (ou de `DesktopApp`), avec cleanup proprement.

---

### A17 — `kanbanKey` prop inutilisée
- `src/desktop/components/BaseView/KanbanView/KanbanCard.tsx:13` — prop passée mais jamais lue.
- `src/mobile/components/BaseView/KanbanView/MobileKanbanCard.tsx:14` — idem.

**Recommandation** : supprimer la prop.

---

### A18 — `useFileDrop` : refs miroirs pour stabiliser des callbacks dans un `useEffect([])`
- `src/desktop/hooks/useFileDrop.ts:138-145` — 4 refs (`moveNodeRef`, `reloadRef`, `propagateNoteRenameRef`, `propagateFolderRenameRef`) qui ne servent qu'à contourner les dépendances manquantes du `useEffect`. C'est de l'obfuscation pour faire taire la règle d'exhaustive-deps.

**Recommandation** : extraire la logique de listener dans un module top-level (helpers purs) appelé via les callbacks fournis par le hook ; ou inclure correctement les deps en stabilisant via `useCallback` au niveau supérieur. Voir aussi C1 — le pattern souffre du même problème.

---

### A19 — `tauriUnlisten` et `titlebarCache` sont des singletons module-level
- `src/desktop/hooks/useFileDrop.ts:46,51` — `tauriUnlisten` est nullable et écrasé par chaque montage du hook. Si pour une raison quelconque le hook se monte deux fois (StrictMode dev par exemple), le premier listener fuit (le `tauriUnlisten?.()` au début du nouvel effet le sauve, mais si les montages se chevauchent en async, c'est moins clair).
- `titlebarCache` ne s'invalide jamais — si la fenêtre passe d'un Retina à un externe non-Retina (changement de DPR), les coordonnées de drop seront fausses.

**Recommandation** : invalider `titlebarCache` sur `window.matchMedia('(resolution)').change`. Pour `tauriUnlisten`, le mettre dans un ref Jotai ou un singleton plus défensif.

---

### A20 — `AnchoredDropdown` ne gère que iOS pour mobile (Android tombe en desktop layout)
- `src/shared/components/AnchoredDropdown.tsx:22` — `const isMobile = platform() === "ios"`. Sur Android, le composant retourne le `DesktopDropdown` qui suppose un anchor visible — pas le bon UX mobile.

**Recommandation** : `isMobile = platform() === "ios" || platform() === "android"` (ou réutiliser `isMobile` de `platform.ts`).

---

### A21 — `MobileTabsView` : O(n²) lookup d'onglet
- `src/mobile/components/TabsView/MobileTabsView.tsx:78-79` — `openTabIds.map(id => allNotes.find(n => n.id === id))`. Pour 50 onglets sur un tree de 500 notes → 25 000 comparaisons par render.

**Recommandation** : utiliser `notesByIdAtom` (voir C9).

---

### A22 — `MobileContextMenu` : actions vs labels indexés par numéro magique
- `src/mobile/components/BottomSheet/MobileContextMenu.tsx:118` — labels en array, switch sur `idx`. Toute insertion dans le tableau décale silencieusement les actions.

**Recommandation** : tableau d'objets `{ label, action }` itéré une fois.

---

### A23 — `loadTree` re-lit chaque note même si seule une a changé
- `src/shared/lib/vaultIO.ts:258-307` + `useFileTree.ts:140-145` — chaque event FS déclenche un `reload()` complet (avec debounce 300ms). Bon pour la cohérence, lourd pour les gros vaults.

**Recommandation** (long terme) : faire un reload sélectif en relisant uniquement les paths reçus dans l'event. Le Rust émet déjà `vault:patch` pour le cas write, mais pas pour le rename/delete externe.

---

### A24 — Doublons dans la gestion du clavier mobile : 4 hooks, contrats flous
- `useKeyboardHeight` (retourne `{ keyboardHeight, isKeyboardOpen }`)
- `useKeyboardOffset` (retourne `number`, mort, voir C7)
- `useKeyboardVisible` (mort, voir C7)
- `useAndroidKeyboardOpen` (heuristique fragile basée sur `maxHeight`)

**Recommandation** : un seul `useKeyboard()` qui retourne `{ height, isOpen, isAndroidOpen }` et qui choisit la bonne source selon la plateforme.

---

## 3. Code mort / inutilisé

| Réf | Constat |
|-----|---------|
| `src/mobile/hooks/useKeyboardVisible.ts` | Hook entier non utilisé (voir C7). |
| `src/mobile/hooks/useKeyboardOffset.ts` | Idem (voir C7). |
| `src/mobile/components/Floating/FloatingInput.tsx` | Composant inachevé/jamais consommé (voir C6). |
| `src/desktop/components/FileTree/FileNode.tsx:86,138` | `editableRef` créé mais l'API `startEdit` n'est jamais appelée. |
| `src/desktop/components/FileTree/FileNode.tsx:79` | Prop `depth` reçue par `FileNodeComponent` mais jamais lue. |
| `src/desktop/components/BaseView/KanbanView/KanbanCard.tsx:13`, `MobileKanbanCard.tsx:14` | Prop `kanbanKey` inutilisée. |
| `src/desktop/components/Frontmatter/hooks/useFrontmatter.ts:18` | TODO `//régler tous les types any` — aucun `any` restant dans le fichier. |
| `src/desktop/components/SideBar/SideBarResizable.tsx:68, 169` | TODOs incomplets ou obsolètes. |
| `src/desktop/components/FileTree/FileNode.tsx:50` | TODO `pourquoi j'utilise autre chose que NoteType.FOLDER` — incohérence entre `kind` et `type`. |
| `src/shared/hooks/useAudioRecorder.ts:47` | TODO sur le plugin pas vraiment buildé. |
| `src/mobile/components/FileTree/MobileFileTree.tsx:69`, `MobileTabsView.tsx:17` | `NOOP_DRILL = () => {}` singleton sans gain — utiliser lambda inline. |
| `src/desktop/components/BaseView/TableView/TableCell.tsx:20-25` | `REF_PROP_TRIGGER_RE` + `getNoteProperties` dupliqués depuis `FrontmatterValue.tsx`. |
| `src/desktop/hooks/useTemplateConstraints.ts:8-12` | `toArray()` redéfini (voir A8). |
| `src/desktop/components/Frontmatter/FrontmatterEditor.tsx:33` | `isMobile = platform() === "ios"` — appel Tauri à chaque render. Utiliser `isMobile` de `src/shared/lib/platform.ts`. |
| `src/desktop/components/Frontmatter/FrontmatterValue.tsx:56` | Idem — `platform()` à chaque render. |
| `src/shared/components/NodeIconProvider.tsx:35` | Retourne `undefined` implicitement si `type` est inconnu (anti-pattern React). Retourner `null`. |

---

## 4. Style / mauvaises pratiques React

### S1 — `forwardRef` + `useImperativeHandle` partout : obsolète en React 19
React 19 accepte `ref` comme une prop normale ; `forwardRef` est superflu (et déprécié à terme).
- `src/shared/components/NoteEditor/NoteEditor.tsx:36` — `forwardRef<EditorHandle, Props>`.
- `src/shared/components/NoteEditor/MarkdownEditor.tsx:221` — `forwardRef` + `useImperativeHandle` qui ré-implémente toutes les commandes de l'éditeur en méthodes impératives.
- `src/shared/components/EditableText.tsx:20,107` — `forwardRef<EditableTextHandle>` + `useImperativeHandle(...startEdit...)`. Et personne n'appelle `startEdit` (voir code mort). À supprimer entièrement.
- `src/shared/plugins/audio-block/AudioBlockComponent.tsx:568` — pas de forwardRef mais beaucoup de refs partagées avec le shell via props (`titleEditingRef`, `playToggleRef`, etc.) — pattern parlable, mais à reconsidérer en context ou en atom dédié.

**Recommandation** : ces `useImperativeHandle` exposent des commandes (`bold`, `italic`, etc.) → ils trahissent que l'éditeur ne devrait pas être encapsulé dans un composant React mais derrière une API impérative simple `editorApi`. Soit on accepte cette API (et alors on la sort du composant), soit on diffuse les commandes via Jotai actions.

---

### S2 — `useEffect` qui synchronisent un atom à partir d'un autre — à remplacer par atom dérivé
- `src/shared/components/NoteEditor/NoteEditor.tsx:55-57, 60-71` (`displayMode`, `documentMap`) — voir A14, A15.
- `src/desktop/components/Settings/SettingsModal.tsx:44-50` — `useState<icloudPath>` + `useEffect` pour fetch. Pourrait être un atom asynchrone (Jotai `atom(get => invoke(...))`).

---

### S3 — `setTimeout(..., 0)` ou délais fixes pour le focus
- `src/desktop/components/Frontmatter/FrontmatterEditor.tsx:94` — `setTimeout(() => setEditingKey(newKey), 0)`.
- `src/desktop/components/Frontmatter/NoteSelector.tsx:25-29` — `setTimeout(..., 300)` (synchronisé avec l'animation BottomSheet).
- `src/desktop/components/Frontmatter/PropertySelector.tsx:27-31` — idem.
- `src/desktop/components/BaseView/TableView/TableRow.tsx:38` — `setTimeout(() => titleRef.current?.select(), 0)`.
- `src/mobile/components/Floating/FloatingInput.tsx:25` — `setTimeout(..., 50)`.

**Recommandation** : pour le pattern "focus après ouverture", préférer une `ref callback` qui focus dès que l'élément est attaché ; ou écouter `transitionend`/`animationend` quand on dépend d'une animation.

---

### S4 — `biome-ignore useExhaustiveDependencies` sans explication
- `src/desktop/DesktopApp.tsx:56, 62` — pas de raison.
- `src/desktop/components/FileTree/FileNode.tsx`, `KanbanView.tsx:61, 74`, `MobileKanbanView.tsx:57-66, 68-88`, etc. — comments vides `<explanation>`.

**Recommandation** : règle d'équipe : tout `biome-ignore` doit citer la raison réelle, sinon il est interdit.

---

### S5 — Casts `as any` et `as unknown as ...`
- `src/shared/lib/vaultIO.ts:49, 64, 72, 82, 93, 107` — `{ baseDir: null } as any` (limitation Tauri, OK mais nombreuse).
- `src/desktop/components/Frontmatter/FrontmatterEditor.tsx:49` — `(activeNote?.type as any) ?? null` injustifié.
- `src/desktop/hooks/useFileDrop.ts:160, 387, 401` — `payload as any` à plusieurs endroits.
- `src/shared/plugins/audio-block/AudioBlockComponent.tsx:472, 486` — `(canvasRef.current as any)?._drawBars` — accès à une fonction stockée sur l'élément DOM (anti-pattern, voir audit plugins).

**Recommandation** : typer les payloads, supprimer le `as any` sur `__Type__`, et retourner explicitement `drawBars` depuis `drawWaveform` plutôt que de l'attacher au canvas.

---

### S6 — `prop drilling` injustifié (handlers sans dépendances locales)
- `src/desktop/components/BaseView/BaseView.tsx:82-102` — `handleCreateChild` déclaré dans `BaseView` et passé à `KanbanView` + `TableView`. Légitime car partagé entre 2 enfants → conforme à la préférence (au-delà d'un enfant, on garde le hoisting).
- `src/mobile/components/FileTree/FileRow.tsx:82-97` — prop `onLongPress` passée par MobileFileTree à FileRow pour un seul usage (mettre une note dans `mobileContextMenuAtom`). FileRow pourrait consommer directement `mobileContextMenuAtom` via `useSetAtom`.
- `src/mobile/components/Search/SearchView.tsx:62-68` — même chose : `onLongPress` qui ne fait que `setContextMenu`.
- `src/shared/components/NoteEditor/NoteEditor.tsx:33` — `displayModeHandlerRef` passé en prop puis remonté via ref ; le pattern est tordu et trahit qu'on devrait piloter `displayMode` via un atom (déjà existant).

**Recommandation** : pour les cas mono-enfant qui ne dépendent que d'atomes, déplacer la logique dans l'enfant directement.

---

### S7 — `getCurrentWebview().onDragDropEvent` posé à l'import (MarkdownEditor)
Voir A16. C'est aussi un "smell" à éviter en général.

---

### S8 — `try { source.stop() } catch {}` silencieux nombreux dans AudioBlockComponent
- `AudioBlockComponent.tsx:117, 284, 352, 454` — pattern à 4 reprises pour gérer le fait qu'un `AudioBufferSourceNode.stop()` lève une exception si déjà stoppé. C'est techniquement correct (Web Audio API impose ce pattern), mais 4 répétitions sans helper. Idem `try { fn() } catch {}` plus haut.

**Recommandation** : helper `safeStop(source)` qui factorise et qui log au warn si l'erreur n'est pas l'erreur attendue.

---

### S9 — `Atoms.ts` capitalisé (et CLAUDE.md référence `atoms.ts`)
Note de cohérence : la doc parle de `src/lib/atoms.ts`, le fichier est `src/shared/lib/Atoms.ts`. À aligner (renommer en `atoms.ts`).

---

### S10 — Fichiers trop longs (>250 lignes)
- `src/shared/plugins/audio-block/AudioBlockComponent.tsx` — 690 lignes, mélange état audio + DOM + handlers + waveform.
- `src/shared/components/NoteEditor/MarkdownEditor.tsx` — 568 lignes, mélange config Milkdown + image NodeView + drop handler + commandes.
- `src/shared/hooks/useFileTree.ts` — 556 lignes, expose 14 méthodes (cf C1).
- `src/shared/lib/vaultIO.ts` — 477 lignes, mélange IO + parsing + scope Tauri + templates.
- `src/shared/plugins/customKeymap.ts` — 473 lignes.
- `src/mobile/components/Dictaphone/MobileDictaphone.tsx` — 469 lignes.
- `src/desktop/hooks/useTemplateSync.ts` — 431 lignes.
- `src/desktop/hooks/useFileDrop.ts` — 415 lignes.
- `src/desktop/components/Frontmatter/FrontmatterValue.tsx` — 387 lignes.

**Recommandation** : voir `Refactoring.md` pour le découpage proposé.

---

## 5. Notes transverses

### N1 — Performance probable au démarrage sur gros vault
`loadTree` est récursif et lit chaque `.md` en parallèle (Promise.all), puis `applyAllTemplates` re-écrit les fichiers modifiés. Sur un vault de >1000 notes, on a observé que :
- chaque note est lue (OK),
- les notes sans `__Type__` sont ré-écrites (voir A2),
- les notes templatées sont ré-écrites (voir A2),
- puis le watcher démarre et risque de capter ses propres writes.

Il y a une protection (`writingPathsRegistry`) mais elle n'est utilisée que dans `updateNote` et `persistNotePatch`, pas dans `loadTree` ni `applyAllTemplates`. Risque de cascade selon le timing.

### N2 — Cycle d'imports croisés
`useNote` importe `useFrontmatter` (depuis `desktop/`) et `useTemplateSync` (depuis `desktop/`). Or `useNote` est dans `shared/`. Cela signifie que le code partagé dépend du code desktop → en mobile, ces hooks sont quand même chargés et exécutés. À documenter ou à séparer plus proprement.

### N3 — `MobileApp.tsx` : animation complexe
La gestion push/pop/swipe dans `MobileApp.tsx:75-159` mélange `useLayoutEffect`, `useEffect`, `requestAnimationFrame`, `setTimeout` et plusieurs refs miroirs. La logique est correcte mais devient difficile à modifier sans casser. Voir A11.

### N4 — `useImperativeHandle` pour exposer `startEdit` jamais appelé (EditableText)
Cas typique d'API impérative qui semblait nécessaire et qui ne l'est pas. À supprimer entièrement.

### N5 — `MarkdownEditor` use plus de 20 plugins Milkdown
Pas un problème en soi, mais une réorganisation en groupes (commonmark+gfm / structure / éditeur / commandes / médias) faciliterait la lecture.

---

## Récapitulatif

| Sévérité | Nombre |
|----------|--------|
| Critique (C) | 11 |
| Architecture (A) | 24 |
| Code mort (M) | 16 entrées |
| Style (S) | 10 |

Voir `Refactoring.md` pour le plan d'action ordonné et regroupé en lots traitables.
