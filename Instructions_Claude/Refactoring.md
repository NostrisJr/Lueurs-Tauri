# Plan de refactoring — Lueurs

> Dérivé de `Audit.md`. Lots ordonnés par dépendances et par valeur d'impact.
> Convention : chaque lot doit être terminé (code + test manuel) avant le suivant pour éviter les conflits.

---

## Lot 0 — Nettoyage immédiat (sans risque)

**Objectif** : virer le code mort et les redondances triviales pour réduire la surface du codebase avant les refactos sérieux.

**Effort estimé** : 1-2 h. Aucun impact fonctionnel.

1. Supprimer les fichiers morts :
   - `src/mobile/hooks/useKeyboardVisible.ts`
   - `src/mobile/hooks/useKeyboardOffset.ts`
   - `src/mobile/components/Floating/FloatingInput.tsx`
2. Supprimer les imports `editableRef` et `useRef<EditableTextHandle>` inutilisés :
   - `src/desktop/components/FileTree/FileNode.tsx:86, 138`
3. Supprimer les props `kanbanKey` inutilisées :
   - `src/desktop/components/BaseView/KanbanView/KanbanCard.tsx:13`
   - `src/mobile/components/BaseView/KanbanView/MobileKanbanCard.tsx:14`
4. Supprimer la prop `depth` non lue dans `FileNodeComponent` (`src/desktop/components/FileTree/FileNode.tsx:79`).
5. Remplacer `NOOP_DRILL = () => {}` par lambda inline :
   - `src/mobile/components/FileTree/MobileFileTree.tsx:69`
   - `src/mobile/components/TabsView/MobileTabsView.tsx:17`
6. Renommer `src/shared/lib/Atoms.ts` → `atoms.ts` (cohérence avec CLAUDE.md). Patcher tous les imports.
7. Réparer le retour implicite `undefined` :
   - `src/shared/components/NodeIconProvider.tsx:35` — ajouter `return null;` final.
8. Nettoyer les TODOs obsolètes :
   - `src/desktop/components/Frontmatter/hooks/useFrontmatter.ts:18` (TODO `any` qui n'existe plus)
   - `src/desktop/components/SideBar/SideBarResizable.tsx:68, 169`
   - `src/desktop/components/FileTree/FileNode.tsx:50`
9. Forcer le comportement `isMobile` (depuis `platform.ts`) dans `AnchoredDropdown.tsx:22` pour couvrir Android.

**Validation** : `pnpm tsc` + `pnpm biome check src/` doivent passer.

---

## Lot 1 — Sécuriser l'écriture des notes (C1)

**Objectif** : éliminer la possibilité de race sur les écritures de notes liée au multi-instanciation de `useFileTree`.

**Effort estimé** : 1 demi-journée.

**Étapes** :
1. Déplacer en module-level (singleton, à côté de `writingPathsRegistry`) :
   - `debounceTimers: Map<string, { timer, flush }>`
   - `reloadTimer: ReturnType<typeof setTimeout> | null`
   - `unwatchRef: (() => void) | null`
2. Convertir `updateNote`, `reload`, `startWatcher`, `flushPendingWrite` en fonctions du module qui acceptent les setters Jotai nécessaires en paramètres (ou via `store.get/set` directement).
3. `useFileTree()` devient un hook fin qui retourne des `useCallback` stables (basés sur les fonctions du module + setters).
4. Tester :
   - Frapper rapidement dans une note pendant qu'une autre instance (Sidebar) touche le tree.
   - Renommer une note pendant la frappe (debounce doit flusher avant rename).
   - Côté mobile : enregistrer un audio (MobileDictaphone) puis taper dans la note ; vérifier qu'aucune écriture n'est perdue.

**Validation** : test manuel d'écritures concurrentes. Idéalement, ajouter un compteur dans le logger pour vérifier qu'il n'y a qu'un seul timer par fileId.

---

## Lot 2 — Atom dérivé `notesByIdAtom` (C8, C9, A4, A21)

**Objectif** : O(1) au lieu de O(n) pour tous les `flattenTree(...).find(id)`.

**Étapes** :
1. Dans `src/shared/lib/atoms.ts`, ajouter :
   ```
   export const notesByIdAtom = atom(get =>
     new Map(flattenTree(get(treeAtom)).map(n => [n.id, n]))
   );
   ```
2. Réécrire `activeNoteAtom` :
   ```
   export const activeNoteAtom = atom(get => {
     const id = get(activeNoteIdAtom);
     return id ? get(notesByIdAtom).get(id) ?? null : null;
   });
   ```
3. Réécrire `kanbanCardsAtom` pour utiliser `notesByIdAtom`.
4. Remplacer les usages de `flattenTree(useAtomValue(treeAtom)).find(...)` par `useAtomValue(notesByIdAtom).get(...)` dans :
   - `useNote.ts:60`
   - `TableRow.tsx:28` (passer `allNotes` calculé une fois dans TableView)
   - `MobileTableRow.tsx:28`
   - `TableCell.tsx:56-59`
   - `FrontmatterRow.tsx:159`
   - `MobileTabsView.tsx:78-79`
   - tous les `getCurrentNotes()` dans `useFrontmatter.ts`, `usePathPropagation.ts`, `useTemplateSync.ts`
5. Vérifier que les composants qui ont besoin de la liste ordonnée (TableView pour itérer) utilisent toujours `tree` (pas `notesByIdAtom`).

**Validation** : kanban avec 100+ enfants doit rester fluide à la frappe ; flame chart React DevTools doit montrer que `activeNoteAtom` ne fait plus de full-scan.

---

## Lot 3 — Réduire la propagation et la comparaison d'égalité

**Objectif** : éviter les fausses détections de changement (C11) et les recalculs (A3, A6, A7).

**Étapes** :
1. **C11** — remplacer la comparaison `JSON.stringify(frontmatter) !== JSON.stringify(...)` dans `useNote.ts:67` par une comparaison par clés triées ou un `deepEqual` léger (`fast-deep-equal` ou maison).
2. **A6** — réécrire `arraysEqual` dans `useFrontmatter.ts:22-27` avec un Set.
3. **A7** — simplifier `rowsAtom` dans `frontMatterAtoms.ts:9-47` : sortir le `JSON.stringify` ; comparer key-sets et key-values via égalité référence + check léger.
4. **A3** — cacher `resolveAllHeirs` / `resolveHeirBases` dans `useTemplateSync.ts` à l'intérieur d'un même cycle : passer une `allNotes` ou un index en paramètre.

**Validation** : ouvrir une note avec un template, modifier une valeur d'une propriété forcée — vérifier qu'il n'y a qu'un seul write disque et pas de cascade.

---

## Lot 4 — Effets parasites mobile : scroll & long-press

**Objectif** : éliminer les races sur le scroll (C2) et les listeners orphelins (C4).

**Étapes** :
1. **C2** — fusionner les deux `useEffect` de `MobileEditor.tsx:93-112` en un seul, basé sur `[keyboardHeight, activeNote?.id]`, qui calcule le `scrollTop` final une seule fois.
2. **C4** — `FileTreeHeader.tsx:75-84` : cleanup systématique (return du useEffect retire toujours le listener, indépendamment de `showMenu`).
3. `MobileKanbanCard.tsx:83-89` : passer le long-press par `useLongPress` plutôt qu'un timeout DOM ad-hoc, et garantir le cleanup au démontage.
4. `useMobileSwipeGesture.ts:50` : ajouter ref pour les setTimeout, clear au démontage.
5. `useLongPress.ts:25-31` : réinitialiser `suppressNextClickRef` au début du long-press, pas seulement à `handleTouchStart`.
6. `BottomSheet.tsx:55-69` : ajouter `e.preventDefault()` dans onTouchMove quand `dy > 0`.

**Validation** : ouvrir/fermer rapidement le menu mobile pendant que le clavier monte ; long-press sur une carte kanban suivi d'un swipe doit annuler proprement.

---

## Lot 5 — Cycle de vie audio (C3, A1, S8)

**Objectif** : éliminer les leaks et l'usage de variables module-level fragiles dans le bloc audio.

**Étapes** :
1. **C3** — `audio-block/node-view.ts:97-101` : ajouter au `destroy()` :
   ```
   if (_globalDesktopStop === maStopFn) _globalDesktopStop = null;
   ```
   Ou bien refactoriser la coordination multi-bloc avec un Set d'unsub + un module dédié `audioCoordinator.ts`.
2. **A1** — `task-list/taskListPlugin.ts:55,70` et `heading-fold/headingNodeView.ts:64-133` : retourner un `destroy()` qui retire les listeners. Sauvegarder les références exactes pour pouvoir `removeEventListener`.
3. **S8** — créer `safeStop(source, label)` helper dans `audio-block/` pour factoriser les 4 try/catch silencieux.
4. **A19 partiel** — déplacer le drop-handler `getCurrentWebview().onDragDropEvent` de `MarkdownEditor.tsx:196-211` (top-level) dans un `useEffect([])` (avec cleanup) du composant `DesktopApp` ou `MarkdownEditor`.
5. **A12 + leak** — `WaveformDisplay.tsx:153` : séparer en deux `useEffect` : (1) `[isActive]` pour register/unregister, (2) `[width, height, color]` pour resize/repaint. Stocker `cancelListener` dans un ref accessible synchrone (avant l'await).

**Validation** : ouvrir un bloc audio, jouer, naviguer vers une autre note pendant la lecture, revenir. Vérifier les logs : pas de "premier événement amplitude" en double, pas d'erreur sur refs nullifiées.

---

## Lot 6 — Atom dérivés au lieu d'effets synchros (A14, A15, S2)

**Objectif** : éliminer les `useEffect` qui ne font que synchroniser un atom à partir d'un autre.

**Étapes** :
1. `displayModeAtom` devient dérivé :
   ```
   export const displayModeAtom = atom(get => {
     const note = get(activeNoteAtom);
     const saved = note?.frontmatter.__DisplayMode__ as DisplayMode | undefined;
     return saved === "livre" || saved === "normal" ? saved : get(defaultDisplayModeAtom);
   });
   ```
   Supprimer le `useEffect` correspondant dans `NoteEditor.tsx:60-71`.
2. Idem pour `documentMapAtom` : si l'on souhaite vider quand la note est une base, créer un atom dérivé `documentMapForActiveAtom`. Sinon, garder l'effet existant mais le justifier.
3. `SettingsModal.tsx:44-50` : remplacer `useState<icloudPath>` + `useEffect` par un atom asynchrone Jotai (ou laisser tel quel — ce n'est pas critique).

**Validation** : vérifier que le passage d'une note normale à une note `__base__` met immédiatement à jour les états (pas de flicker dû à la fin de l'effet).

---

## Lot 7 — Découpe des fichiers longs (S10)

**Objectif** : aucun fichier au-delà de ~300 lignes.

**Suggestions de découpe** :

### `useFileTree.ts` (556 lignes)
Séparer en :
- `lib/treeIO.ts` : `loadTree`, `noteFromRaw` (déjà presque fait via `vaultIO.ts`)
- `hooks/useVaultRegistration.ts` : `allowVaultScope`, `pickFolder`, `switchVault`, `initFolder`, `autoInitFolder`
- `hooks/useVaultWatcher.ts` : `startWatcher`, `reload`
- `hooks/useNoteWrites.ts` : `updateNote`, `flushPendingWrite`, `createNote`, `deleteNote`
- `hooks/useFolderMutations.ts` : `createFolder`, `deleteFolder`, `renameNode`, `moveNode`, `openFolderNote`

Le tout coordonné par les singletons décidés au Lot 1.

### `vaultIO.ts` (477 lignes)
- `lib/vaultPaths.ts` : `toRelative`, `toAbsolute`, `absolutifyPathFields`, `relativizePathFields`, `PATH_FIELDS`, `FORMULA_REF_RE`
- `lib/vaultLoadTree.ts` : `loadTree`, `noteFromRaw`, `applyAllTemplates`
- `lib/vaultIO.ts` (conservé) : `vaultIO` object, `persistNotePatch`, `resolveDestName`, `allowVaultScope`

### `customKeymap.ts` (473 lignes)
Séparer chaque commande en sous-fichier `plugins/customKeymap/<commande>.ts` et faire un `index.ts` qui les regroupe.

### `AudioBlockComponent.tsx` (690 lignes)
- `hooks/useDesktopAudio.ts` : tout le cycle desktop (audioCtx, source, RAF, coordination)
- `hooks/useMobileAudio.ts` : subscribe natif, playback mobile
- `components/AudioTitle.tsx` : édition du titre
- `components/AudioWaveform.tsx` : canvas + handleWaveformClick
- `AudioBlockComponent.tsx` : assemblage et JSX

### `MarkdownEditor.tsx` (568 lignes)
- `lib/imageNodeView.ts` : `makeImageNodeViewBuilder`, `makeImageNodeViewPlugin`, `readVaultBytesAndroid`
- `lib/dropListener.ts` : enregistrement du drop singleton (placé dans `useEffect` du DesktopApp comme au Lot 5)
- `MarkdownEditor.tsx` : composant + commandes impératives (à terme à éliminer, voir Lot 9)

### `MobileDictaphone.tsx` (469 lignes)
Voir audit mobile : découpe en `DictaphoneSheet`, `DictaphonePill`, `DictaphoneControls`, `useDictaphoneState`.

### `useTemplateSync.ts` (431 lignes), `useFileDrop.ts` (415 lignes), `FrontmatterValue.tsx` (387 lignes)
À découper selon la même logique : séparer state hook vs handlers vs rendu vs helpers purs.

**Validation** : `pnpm tsc` + tests manuels avant/après chaque découpe (ne pas chaîner toutes les découpes d'un coup).

---

## Lot 8 — Factorisation des helpers dupliqués (A8, A9, A10)

**Objectif** : une seule définition par helper.

**Étapes** :
1. **A8** — `toArray` : importer partout depuis `fileTreeHelpers.ts`, supprimer les copies dans `useTemplateConstraints.ts`, `usePathPropagation.ts`, `useFrontmatter.ts`.
2. **A9** — déplacer `REF_PROP_TRIGGER_RE` et `getNoteProperties` dans `frontmatterUtils.ts` ; importer depuis `TableCell.tsx` et `FrontmatterValue.tsx`.
3. **A10** — `vaultDisplayName` mobile : créer `src/mobile/lib/vault.ts` et importer depuis `FileTreeHeader.tsx` et `MobileSettingsView.tsx`.
4. **A13** — `frontmatterUtils.toFrontmatter` : utiliser `row.isNoteArray` au lieu de l'heuristique virgule (line 41-46).

---

## Lot 9 — Élimination des `forwardRef` + `useImperativeHandle` (S1)

**Objectif** : moderniser pour React 19. Au passage, repenser l'API impérative de l'éditeur.

**Étapes** :
1. `EditableText` : supprimer entièrement le pattern `useImperativeHandle(startEdit)` — l'API n'est jamais appelée.
2. `NoteEditor` / `MarkdownEditor` : extraire les commandes (`bold`, `italic`, `heading`, etc.) dans un module impératif `editorCommands.ts` qui prend l'`editorRef` en argument. Les composants `EditorToolbar` et `MobileFormattingBar` appellent directement `editorCommands.bold(editorRef)`.
3. À terme : éliminer les refs cross-component (`titleEditingRef`, `playToggleRef` dans audio-block) au profit d'un atom Jotai dédié `audioFocusAtom`.

**Validation** : tester toutes les commandes de la toolbar (desktop + mobile).

---

## Lot 10 — Refactos de surface (S3, S4, S5)

**Objectif** : qualité du code, lisibilité.

**Étapes** :
1. **S3** — Remplacer tous les `setTimeout(..., 0|50|300)` pour focus par :
   - `ref` callback (`<input ref={el => el?.focus()}>`)
   - `transitionend` listener pour les cas dépendant d'une animation
2. **S4** — Pour chaque `biome-ignore useExhaustiveDependencies` avec `<explanation>` vide : soit fixer les deps, soit ajouter une explication claire.
3. **S5** — Audit des `as any` : supprimer ceux qui sont injustifiés (notamment `FrontmatterEditor.tsx:49`, `MarkdownEditor.tsx` payloads, `getNoteProperties` dans `useFileDrop`). Typer les payloads Tauri proprement (interface `WebviewDragDropPayload`).
4. **S6** — Prop drilling :
   - `FileRow.tsx` : supprimer prop `onLongPress`, consommer `mobileContextMenuAtom` directement.
   - `SearchView.tsx:62-68` : idem.
   - `NoteEditor.tsx:displayModeHandlerRef` : remplacer par un atom action.

---

## Lot 11 — Optimisations de fond (A2, A11, A18, A19, A23, A24)

**Objectif** : qualité long terme.

**Étapes** (par ordre d'impact décroissant) :
1. **A11** — hook `usePushAnimation(condition, duration)` réutilisable pour `MobileApp` et `MobileFileTree`.
2. **A24** — fusionner les hooks clavier mobile en un seul `useKeyboard()` retournant `{ height, isOpen, isAndroidOpen }`. Supprimer les hooks morts (déjà fait au Lot 0).
3. **A2** — `loadTree` + `applyAllTemplates` : marquer les writes via `writingPathsRegistry` ; éviter d'écrire le `__Type__` inféré si ce n'est pas strictement nécessaire (idée : ne le persister que lors d'une vraie édition de la note).
4. **A18, A19** — refactoriser `useFileDrop` pour éliminer les refs miroirs (cf. Lot 1) et invalider `titlebarCache` sur changement de DPR.
5. **A23** — `reload()` sélectif : utiliser les paths reçus dans l'event pour ne relire que les nœuds concernés (gain notable sur gros vaults).

---

## Ordre recommandé

```
Lot 0  (nettoyage)
  ↓
Lot 1  (race d'écriture) ─── prérequis pour la sérénité de la suite
  ↓
Lot 2  (notesByIdAtom)   ─── prérequis pour Lot 3
  ↓
Lot 3  (égalité/diff)    ─── prérequis pour Lot 6
  ↓
Lot 4  (mobile effects)   } indépendants entre eux,
Lot 5  (audio lifecycle)  } peuvent être parallélisés
  ↓
Lot 6  (atom dérivés)
  ↓
Lot 7  (découpe fichiers)  ── à faire fichier par fichier, pas en bloc
  ↓
Lot 8  (factorisation)
  ↓
Lot 9  (forwardRef)
  ↓
Lot 10 (surface)
  ↓
Lot 11 (optimisations de fond)
```

**Note** : après chaque lot, lancer `pnpm tsc`, `pnpm biome check src/`, et un test manuel sur les fonctionnalités touchées. Mettre à jour `Documentation-technique.md` quand un lot modifie une décision d'architecture documentée (notamment Lot 1, 2, 5).
