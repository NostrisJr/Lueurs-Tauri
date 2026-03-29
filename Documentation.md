# Lueurs — Documentation

## Conventions de notation

La notation `__Mot__` (doubles tirets bas, majuscule initiale) désigne un **champ système**. La notation `__mot__` (doubles tirets bas, sans majuscule) désigne une **valeur système**. Ces éléments sont gérés automatiquement par Lueurs. Dans l'interface, les tirets bas ne s'affichent pas.

---

## Structure du vault

Un vault Lueurs contient deux dossiers gérés par l'application, qui ne sont pas visibles dans l'explorateur de Lueurs :

- `resources/` — ressources binaires (audio, images) insérées dans les notes.
- `config/` — configuration du vault : templates et types personnalisés, éditables depuis Lueurs ou depuis Obsidian.

---

## Types de notes

Chaque note possède un champ `__Type__` obligatoire dans son frontmatter. Ce champ est ajouté automatiquement à l'ouverture d'une note si il est absent. Les types sont sensibles à la casse.

### `__note__`

Le type par défaut. Une note markdown standard.

### `__folder__`

Hérite de `__note__`. Une note `__folder__` représente l'espace d'édition d'un dossier, à la manière de Notion : chaque dossier peut avoir une note associée, accessible en cliquant sur le dossier dans l'arbre. Cette note porte le même nom que son dossier parent.

Elle est créée automatiquement à la première ouverture du dossier si elle n'existe pas encore. Elle n'apparaît pas dans l'arbre de fichiers. Le renommage d'un dossier renomme automatiquement la note associée.

### `__template__`

Hérite de `__note__`. Un template définit un ensemble de propriétés que d'autres notes devront posséder obligatoirement. Les propriétés d'un template sont propagées automatiquement à toutes les notes héritières dès qu'une modification est effectuée sur le template.

### `__base__`

Une base est un agrégat de notes. Elle expose une vue structurée de toutes les notes qui lui sont associées via leur propriété `__Base__`. Plusieurs types de vues sont disponibles, sélectionnables depuis la barre d'outils de la base.

---

## Vocabulaire des propriétés

Lueurs distingue trois types de propriétés dans le frontmatter d'une note :

- **Propriété libre** — définie directement sur la note, sans lien avec un template. Elle peut être renommée et supprimée librement.
- **Propriété contraignante** — issue d'un template, mais dont la valeur est laissée libre : la note peut renseigner sa propre valeur. La clé est non renommable et non supprimable depuis la note.
- **Propriété imposée** — issue d'un template avec une valeur fixée : cette valeur est automatiquement copiée sur toutes les notes héritières et ne peut pas être modifiée depuis la note. La clé et la valeur sont toutes deux verrouillées.

Dans l'interface, les propriétés contraignantes et imposées sont affichées avec leur clé en ambre. Les valeurs imposées sont grisées.

---

## Propriétés système

### `__Template__`

Array de chemins vers des notes de type `__template__`. Les propriétés définies dans les templates listés sont automatiquement présentes dans le frontmatter de la note.

- Si une propriété du template a une valeur vide, elle est ajoutée à la note comme propriété contraignante — la note peut renseigner sa propre valeur.
- Si une propriété du template a une valeur non vide, elle est ajoutée comme propriété imposée — la valeur est forcée et ne peut pas être modifiée depuis la note.

Dans l'interface, les clés issues d'un template sont non renommables et non supprimables depuis la note. Les valeurs imposées sont grisées.

Lorsqu'un template est retiré d'une note, les propriétés héritées restent dans le frontmatter de la note.

Pour une note `__base__`, `__Template__` contraint les propriétés des notes enfant listées dans `__Children__`, et non les propriétés de la base elle-même.

### `__Base__`

Array de chemins vers des notes de type `__base__`. Indique à quelles bases cette note appartient. Lorsqu'une base est ajoutée à ce champ, le chemin de la note est automatiquement enregistré dans la propriété `__Children__` de la base concernée. Le `__Template__` de la base est également automatiquement appliqué à la note.

Lorsqu'une base est retirée de ce champ, le chemin de la note est retiré de `__Children__` de la base concernée.

### `__Children__`

Propriété des notes de type `__base__`. Array de chemins absolus vers les notes enfant de la base. Ce champ est géré automatiquement : il est mis à jour dès qu'une note modifie sa propriété `__Base__`, et à la suppression ou au renommage d'une note enfant. Un bouton **Refresh** permet de reconstruire manuellement l'ensemble des `__Children__` du vault en reparsant tous les fichiers, utile notamment après des modifications effectuées depuis un autre logiciel.

```yaml
__Children__:
  - /chemin/absolu/vers/note1.md
  - /chemin/absolu/vers/note2.md
```

### `__View__`

Propriété des notes de type `__base__`. Indique la vue active de la base. Valeurs possibles : `table`, `kanban`. Absente ou vide, la vue tableau est affichée par défaut.

### `__KanbanKey__`

Propriété des notes de type `__base__`. Indique la propriété des notes enfant utilisée comme clé de groupement dans la vue Kanban. La valeur de cette propriété détermine dans quelle colonne chaque note apparaît.

### `__KanbanColumns__`

Propriété des notes de type `__base__`. Stocke la définition des colonnes Kanban sous forme de JSON. Chaque colonne possède un identifiant interne stable et un label affiché dans l'interface. Ce champ est géré automatiquement par Lueurs lors de la configuration de la vue Kanban.

```yaml
__KanbanColumns__: '[{"id":"col_abc","label":"À faire"},{"id":"col_def","label":"Fait"}]'
```

### `__TableColumns__`

Propriété des notes de type `__base__`. Stocke les largeurs des colonnes de la vue tableau sous forme de JSON. Ce champ est géré automatiquement lors du redimensionnement des colonnes.

```yaml
__TableColumns__: '{"Status":180,"Date de fin":220}'
```

---

## Vues de base

Les notes de type `__base__` exposent leurs notes enfant sous forme de vue structurée. La vue active est sélectionnable depuis la barre d'outils en haut de la base, et est persistée dans le frontmatter via `__View__`.

### Vue tableau

Vue par défaut. Affiche les notes enfant sous forme de tableau, avec une ligne par note et une colonne par propriété issue des templates de la base.

Les colonnes affichées sont l'union dédupliquée de toutes les propriétés non-système des templates assignés à la base. Si deux templates définissent la même propriété, le premier template prévaut. Les propriétés libres des notes enfant (non issues des templates de la base) ne sont pas affichées.

**Colonnes.** Chaque colonne correspond à une propriété contraignante ou imposée. Les valeurs contraignantes sont éditables directement dans la cellule (double-clic). Les valeurs imposées sont affichées en grisé et ne peuvent pas être modifiées. Un ring apparaît au focus pour indiquer l'état d'édition. Les colonnes sont redimensionnables par glisser-déposer sur leur bord droit ; les largeurs sont persistées dans `__TableColumns__`. Le renommage d'une colonne (double-clic sur le header) renomme la propriété dans tous les templates qui la définissent, et propage le changement à toutes les notes héritières.

**Titre.** La première colonne affiche le titre de chaque note enfant, éditable par double-clic. Le renommage met à jour le fichier et le chemin dans `__Children__` de la base.

### Vue Kanban

Affiche les notes enfant sous forme de tableau Kanban, groupées par les valeurs d'une propriété choisie. Pour activer la vue Kanban :

1. Sélectionner **Kanban** dans le sélecteur de vue — une modal propose les propriétés disponibles.
2. Choisir la propriété à utiliser comme clé de groupement. Seules les propriétés **contraignantes** (sans valeur imposée dans le template) sont proposées, puisque les notes enfant doivent pouvoir y renseigner leur propre valeur.

Une fois configurée, la vue affiche une colonne par valeur distincte trouvée parmi les notes enfant. La clé de groupement active est affichée dans la barre d'outils sous la forme **Groupé par X** ; cliquer dessus permet de changer la propriété à tout moment.

**Colonnes.** Les colonnes peuvent être renommées en cliquant sur leur titre. Renommer une colonne met à jour la valeur correspondante dans le frontmatter de toutes les notes de cette colonne. De nouvelles colonnes peuvent être ajoutées via le bouton **+ Ajouter une colonne** ; les notes dont la valeur correspond au nouveau label y apparaissent automatiquement.

**Colonne "Sans valeur".** Les notes dont la propriété clé est absente ou vide apparaissent automatiquement dans une colonne virtuelle **Sans valeur**, affichée en dernier. Cette colonne n'est pas persistée dans `__KanbanColumns__` : elle apparaît uniquement si au moins une note est dans ce cas, et disparaît dès qu'elles ont toutes une valeur. Déplacer une carte vers cette colonne efface la valeur de la propriété clé dans le frontmatter de la note (la clé reste présente avec une valeur vide). Son titre n'est pas éditable.

**Cartes.** Chaque note enfant est représentée par une carte affichant son titre et sa valeur pour la propriété clé. Les cartes sont déplaçables par glisser-déposer entre colonnes, ce qui met à jour le frontmatter de la note correspondante.

---

## Propagation des templates

Lorsque le frontmatter d'un template est modifié, les changements sont automatiquement propagés à toutes les notes héritières (directement via `__Template__`, ou indirectement via une base dont le `__Template__` inclut ce template). Les règles de propagation sont les suivantes :

- **Ajout d'une propriété** — la propriété est ajoutée à toutes les notes héritières avec la valeur définie dans le template.
- **Suppression d'une propriété** — une confirmation est demandée avant propagation. Si confirmée, la propriété est retirée de toutes les notes héritières. Si la propriété supprimée est utilisée comme `__KanbanKey__` dans une base héritière, une confirmation supplémentaire est demandée pour supprimer la vue Kanban de cette base. Refuser cette confirmation annule entièrement la suppression de la propriété.
- **Modification d'une valeur non vide** — la nouvelle valeur est forcée sur toutes les notes héritières, écrasant leurs valeurs existantes.
- **Renommage d'une propriété** — la clé est renommée dans toutes les notes héritières. Si la note héritière possède déjà une propriété portant le nouveau nom (conflit), la résolution suit ces règles :
  - Propriété **imposée** (valeur non vide dans le template) : la valeur du template prime toujours.
  - Propriété **contraignante** (valeur vide dans le template) : si la propriété en cours de renommage avait déjà une valeur dans la note, cette valeur prime (une prop héritée a priorité sur une prop personnalisée). Si elle était vide, la valeur existante de la note est conservée.
  - Sans conflit : renommage simple, la valeur existante est préservée.
  Il n'est pas possible de renommer une propriété template avec un nom déjà utilisé par une autre propriété du même template : le bouton de confirmation est désactivé dans la modal.

Les notes de type `__base__` sont exclues de la propagation : elles portent `__Template__` pour le transmettre à leurs enfants, pas pour le recevoir elles-mêmes.

---

## Types utilisateur

Les types utilisateur sont des notes de type `__template__` stockées dans `config/`. Ils apparaissent dans l'interface comme des types à part entière, au même titre que `__note__` ou `__base__`. Il est possible de créer de nouveaux types directement depuis Lueurs, ce qui crée la note template correspondante dans `config/`.

---

## Compatibilité Obsidian

Les frontmatters générés par Lueurs sont du YAML standard, lisibles nativement par Obsidian. `__Children__` est un array YAML, pas un objet JSON. `__KanbanColumns__` et `__TableColumns__` sont stockés comme des chaînes JSON entre guillemets simples sur une seule ligne — Obsidian les affiche comme des propriétés texte. Les champs système (`__Type__`, `__Base__`, etc.) apparaissent tels quels dans Obsidian, tirets bas inclus.

---

## Architecture technique

### Vue d'ensemble

Lueurs est une application desktop construite avec **Tauri 2** (Rust + WebView) et **React** côté frontend. Les notes sont des fichiers `.md` stockés dans un dossier vault choisi par l'utilisateur. Toute la persistance est locale : pas de serveur, pas de base de données.

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

### Propagation de templates (Rust)

Lorsque le frontmatter d'un template change, le frontend (`useTemplateSync`) calcule la liste des notes héritières et invoque la commande Rust `propagate_template_change`. Rust traite les fichiers en parallèle (Tokio) et les écrit directement sur le disque sans passer par l'événement `vault:patch`. Le frontend recharge ensuite l'arbre entier ou applique une mise à jour chirurgicale de `treeAtom`.

La commande Rust reçoit un `TemplateChange` décrivant la modification :

- `addProp` — ajouter une propriété si absente
- `removeProp` — supprimer une propriété
- `renameProp { old_key, new_key, template_value }` — renommer une propriété avec résolution de conflit
- `forceValue` — imposer une valeur

Pour le renommage, Rust parse le frontmatter YAML, détecte si `new_key` est déjà présent dans la note (conflit), et applique la règle de résolution : valeur du template si imposée ; pour une propriété contraignante, la valeur de `old_key` prime si elle était non vide (prop héritée > prop personnalisée), sinon la valeur existante de `new_key` est conservée.

### Résolution des propriétés template

`computeTemplateProps` (dans `fileTreeHelpers.ts`) calcule les propriétés qu'une note doit recevoir d'après ses templates. Elle distingue les propriétés imposées (valeur non vide dans le template) des propriétés contraignantes (valeur vide), et ne modifie jamais une valeur déjà renseignée par la note pour une propriété contraignante.

### Choix de conception

**Stockage YAML plat.** Les propriétés système utilisent des clés avec doubles tirets bas (`__Type__`, `__Template__`, etc.) pour éviter les collisions avec les propriétés utilisateur tout en restant lisibles dans n'importe quel éditeur Markdown.

**Propagation via Rust.** Le traitement parallèle des fichiers à la modification d'un template aurait été difficile à faire de manière fiable depuis le frontend (contraintes du FS scope Tauri, concurrence). Rust gère cela proprement avec Tokio et `JoinSet`.

**Local-first.** Aucune donnée ne quitte la machine. Le vault est un dossier de fichiers `.md` standard, modifiable depuis n'importe quel éditeur externe (Obsidian, VS Code, etc.). Lueurs détecte les changements externes via le watcher FS et reconcile son état.