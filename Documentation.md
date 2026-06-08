# Lueurs — Documentation utilisateur

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
- **Propriété à valeurs contraintes (bouton)** — issue d'un template qui définit une liste de valeurs autorisées. La clé est verrouillée mais la note héritière choisit librement sa valeur dans la liste, via un menu déroulant. Voir [Propriétés à valeurs contraintes (boutons)](#propriétés-à-valeurs-contraintes-boutons).

Dans l'interface, les propriétés contraignantes et imposées sont affichées avec leur clé en ambre. Les valeurs imposées sont grisées.

---

## Propriétés système

### `__Template__`

Array de chemins vers des notes de type `__template__`. Les propriétés définies dans les templates listés sont automatiquement présentes dans le frontmatter de la note.

- Si une propriété du template a une valeur vide, elle est ajoutée à la note comme propriété contraignante — la note peut renseigner sa propre valeur.
- Si une propriété du template a une valeur non vide, elle est ajoutée comme propriété imposée — la valeur est forcée et ne peut pas être modifiée depuis la note.
- Si une propriété du template a pour valeur un bouton `$$BUTTON([...],défaut)$$`, elle devient une propriété à valeurs contraintes — la note héritière choisit une valeur dans la liste via un menu déroulant. Voir [Propriétés à valeurs contraintes (boutons)](#propriétés-à-valeurs-contraintes-boutons).

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

## Propriétés à valeurs contraintes (boutons)

Un template peut restreindre une propriété à une liste de valeurs autorisées, parmi lesquelles chaque note héritière choisit via un menu déroulant.

**Déclaration (dans le template).** La valeur de la propriété prend la forme d'un bouton, en réutilisant la syntaxe des formules :

```yaml
Statut: $$BUTTON([À faire;En cours;Fait],À faire)$$
```

- Les valeurs possibles sont listées entre crochets, séparées par des points-virgules `;`.
- Le second paramètre (après la virgule) est la **valeur par défaut** attribuée aux héritiers tant qu'aucun choix n'est fait. Elle peut être l'une des valeurs de la liste, ou une valeur hors-liste servant de placeholder « non choisi ». Si elle est omise (`$$BUTTON([À faire;En cours;Fait])$$`), la première valeur de la liste est utilisée.

**Comportement sur les héritiers.** La propriété est contraignante (clé verrouillée, non renommable ni supprimable) mais sa valeur reste éditable : elle s'affiche comme une pill avec un menu déroulant listant les valeurs autorisées. La valeur choisie est stockée littéralement dans le frontmatter de la note. La pill et son menu apparaissent aussi bien dans le frontmatter de la note que dans les vues de base (tableau).

**Valeur non permise.** Si une note détient une valeur qui n'est plus autorisée (option retirée du template, ou valeur saisie manuellement hors-liste), elle est automatiquement réécrite avec la valeur par défaut.

**Renommage d'une valeur.** Renommer une valeur dans la liste du template (par exemple `En cours` → `Actif`) se répercute sur toutes les notes héritières qui avaient choisi cette valeur.

**Couleurs.** Chaque valeur peut être colorée en réutilisant la syntaxe du surlignage :

```yaml
Statut: $$BUTTON([=={red}Bloqué==;=={orange}En cours==;=={green}Fait==],En cours)$$
```

- `=={color}valeur==` applique la couleur indiquée — mêmes identifiants que le surlignage (`yellow`, `green`, `blue`, `red`, `orange`, `purple`, `gray`).
- `==valeur==` sans identifiant applique la couleur par défaut configurée dans les paramètres (section *Éditeur*).
- Une valeur sans `==` reste neutre (grise).

La pill apparaît dans la couleur associée. Dans le frontmatter du template, la vue compactée affiche les valeurs possibles surlignées ; survoler une valeur fait apparaître un cercle coloré permettant de rechoisir sa couleur, comme pour le surlignage de texte.

---

## Vues de base

Les notes de type `__base__` exposent leurs notes enfant sous forme de vue structurée. La vue active est sélectionnable depuis la barre d'outils en haut de la base, et est persistée dans le frontmatter via `__View__`.

### Vue tableau

Vue par défaut. Affiche les notes enfant sous forme de tableau, avec une ligne par note et une colonne par propriété issue des templates de la base.

Les colonnes affichées sont l'union dédupliquée de toutes les propriétés non-système des templates assignés à la base. Si deux templates définissent la même propriété, le premier template prévaut. Les propriétés libres des notes enfant (non issues des templates de la base) ne sont pas affichées.

**Colonnes.** Chaque colonne correspond à une propriété contraignante ou imposée. Les valeurs contraignantes sont éditables directement dans la cellule (double-clic). Les valeurs imposées sont affichées en grisé et ne peuvent pas être modifiées. Un ring apparaît au focus pour indiquer l'état d'édition. Les colonnes sont redimensionnables par glisser-déposer sur leur bord droit ; les largeurs sont persistées dans `__TableColumns__`. Le renommage d'une colonne (double-clic sur le header) renomme la propriété dans tous les templates qui la définissent, et propage le changement à toutes les notes héritières.

**Titre.** La première colonne affiche le titre de chaque note enfant, éditable par double-clic. Le renommage met à jour le fichier et le chemin dans `__Children__` de la base.

**Agrégations.** Une ligne de pied de tableau permet de calculer une agrégation par colonne. Cliquer sur une cellule du pied ouvre un sélecteur avec les opérations disponibles : Comptage, Somme, Moyenne, Min, Max. Le résultat est recalculé en temps réel à partir des valeurs des notes enfant. L'agrégation active est persistée dans `__TableAggregations__` et expose son résultat comme propriété de la base via une formule automatique (`__Agg_<col>_<op>__`). Le renommage d'une colonne met à jour les agrégations associées.

**Formules.** Une propriété peut contenir une formule de la forme `$$expression$$`. Les formules sont recalculées à l'affichage et ne sont jamais persistées sous leur forme évaluée. Syntaxe disponible :

- `self.prop` — référence la valeur d'une autre propriété de la note
- `ref("NomNote").prop` — référence la valeur d'une propriété d'une autre note du vault
- `agg(col, op)` — agrégation sur les notes enfant de la base (opérations : `count`, `sum`, `avg`, `min`, `max`)
- `round(n, décimales?)`, `iif(condition, alors, sinon)` — utilitaires
- Opérateurs arithmétiques et de comparaison : `+ - * / > < >= <= === !==`

Exemples : `$$round(self.recettes - self.charges, 2)$$`, `$$agg(montant, sum)$$`, `$$ref("Budget").revenu * 0.2$$`.

**Saisie des formules.** Taper `$$` dans un champ texte insère automatiquement la paire fermante (`$$`) et bascule en mode édition de formule. En mode édition, taper `ref(` ouvre un sélecteur de notes — sélectionner une note insère `ref("NomNote")` et positionne le curseur après. Taper ensuite `.` ouvre un sélecteur de propriétés pour compléter la référence. Le chemin absolu de la note est stocké dans le frontmatter ; l'interface n'affiche que le nom de la note.

### Vue Kanban

Affiche les notes enfant sous forme de tableau Kanban, groupées par les valeurs d'une propriété choisie. Pour activer la vue Kanban :

1. Sélectionner **Kanban** dans le sélecteur de vue — une modal propose les propriétés disponibles.
2. Choisir la propriété à utiliser comme clé de groupement. Seules les propriétés **contraignantes** (sans valeur imposée dans le template) sont proposées, puisque les notes enfant doivent pouvoir y renseigner leur propre valeur.

Une fois configurée, la vue affiche une colonne par valeur distincte trouvée parmi les notes enfant. La clé de groupement active est affichée dans la barre d'outils sous la forme **Groupé par X** ; cliquer dessus permet de changer la propriété à tout moment.

**Colonnes.** Les colonnes peuvent être renommées en cliquant sur leur titre. Renommer une colonne met à jour la valeur correspondante dans le frontmatter de toutes les notes de cette colonne. De nouvelles colonnes peuvent être ajoutées via le bouton **+ Ajouter une colonne** ; les notes dont la valeur correspond au nouveau label y apparaissent automatiquement.

**Colonne "Sans valeur".** Les notes dont la propriété clé est absente ou vide apparaissent automatiquement dans une colonne virtuelle **Sans valeur**, affichée en dernier. Cette colonne n'est pas persistée dans `__KanbanColumns__` : elle apparaît uniquement si au moins une note est dans ce cas, et disparaît dès qu'elles ont toutes une valeur. Déplacer une carte vers cette colonne efface la valeur de la propriété clé dans le frontmatter de la note (la clé reste présente avec une valeur vide). Son titre n'est pas éditable.

**Cartes.** Chaque note enfant est représentée par une carte affichant son titre et sa valeur pour la propriété clé. Les cartes sont déplaçables par glisser-déposer entre colonnes, ce qui met à jour le frontmatter de la note correspondante. Le titre d'une carte est éditable par double-clic — le renommage met à jour le fichier et propage le changement de chemin partout dans le vault (même comportement que le renommage du titre dans la vue tableau). Un **Cmd+clic** sur une carte ouvre la note dans un nouvel onglet.

---

## Navigation par onglets

Plusieurs notes peuvent être ouvertes simultanément dans des onglets affichés en haut de l'éditeur.

**Ouvrir une note dans un onglet.** Un clic simple sur une note dans l'explorateur remplace la note active dans l'onglet courant. Un **Cmd+clic** ouvre la note dans un nouvel onglet sans fermer les onglets existants. Si la note est déjà ouverte dans un onglet, elle est simplement activée dans les deux cas.

**Fermer un onglet.** Le bouton **×** visible au survol d'un onglet le ferme. Si l'onglet fermé était actif, l'onglet voisin de gauche est activé (ou celui de droite si c'est le premier). La fermeture d'un onglet ne supprime pas la note — elle reste sur le disque.

**Réorganiser les onglets.** Les onglets sont réorganisables par glisser-déposer.

**Historique d'annulation.** L'historique d'annulation (Cmd+Z) de chaque note est préservé pendant la durée de vie de l'onglet. Il est perdu à la fermeture de l'onglet.

**Liens entre notes (NoteChip).** Dans le frontmatter, les références à d'autres notes (affichées sous forme de chips) s'ouvrent dans un nouvel onglet par **Cmd+clic**.

---

## Éditeur

### Mise en forme

Une barre de mise en forme apparaît au-dessus de l'éditeur markdown. Elle propose les actions suivantes :

- **B** — Gras (⌘B)
- **I** — Italique (⌘I)
- **S** — Barré
- **H1 / H2 / H3** — Transforme le bloc courant en titre de niveau 1, 2 ou 3

Les raccourcis clavier standards fonctionnent également directement dans l'éditeur (⌘B, ⌘I).

### Surlignage couleur

Du texte peut être surligné dans une couleur au choix. Sept couleurs sont disponibles : jaune, vert, bleu, rouge, orange, violet, gris.

**Syntaxe.** `=={color}texte==` dans le Markdown, où `color` est l'identifiant de la couleur (`yellow`, `green`, `blue`, `red`, `orange`, `purple`, `gray`). Taper la syntaxe complète directement dans l'éditeur déclenche la mise en forme automatiquement.

**Raccourci.** `⌘⇧L` surligné la sélection avec la couleur par défaut, ou supprime le surlignage si le curseur est déjà dans un texte surligné.

**Changement de couleur.** Survoler un texte surligné fait apparaître un petit cercle coloré à gauche du texte. Cliquer sur ce cercle ouvre un sélecteur avec les sept couleurs disponibles et un bouton pour supprimer le surlignage.

**Menu contextuel.** Le clic droit dans l'éditeur propose un sous-menu **Surligner** permettant d'appliquer directement une couleur spécifique.

**Couleur par défaut.** La couleur appliquée par le raccourci `⌘⇧L` est configurable dans les paramètres (section *Éditeur*).

### Modes d'affichage

Les notes disposent de deux modes d'affichage, sélectionnables via les icônes en haut à droite de l'éditeur. Le mode actif est persisté dans le frontmatter de la note (`__DisplayMode__`) et restauré à chaque ouverture.

**Mode normal** — affichage par défaut. Police sans empattement (Inter), texte aligné à gauche, code rendu en blocs distincts avec fond grisé.

**Mode livre** — adapté à la lecture de textes longs. Police serif (EB Garamond), texte justifié, indentation de première ligne à chaque paragraphe. Le code y est intégré au flux du texte (italique, sans fond) et délimité par des barres verticales (`| code |`). Les listes utilisent des tirets (`–`) en lieu de puces.

Le mode livre n'est pas disponible pour les notes de type `__base__`.

**Mode par défaut.** Un mode de lecture par défaut peut être défini dans les paramètres de l'application (section *Éditeur*). Ce mode s'applique :
- aux nouvelles notes (aucun `__DisplayMode__` dans le frontmatter) ;
- aux notes existantes qui n'ont jamais eu de mode défini.

Les notes qui possèdent déjà un `__DisplayMode__` dans leur frontmatter conservent leur mode, indépendamment du réglage par défaut.

### Listes

Les listes à puces, numérotées et de tâches supportent l'imbrication sur plusieurs niveaux. Les raccourcis d'édition à l'intérieur d'une liste :

- **Tab** — indente l'item d'un niveau.
- **Maj+Tab** — désindente l'item d'un niveau.
- **Backspace sur une ligne vide** — remonte l'item d'un seul niveau d'indentation (équivalent à Maj+Tab). Au dernier niveau, l'item sort de la liste pour devenir du texte normal.
- **Entrée sur une ligne vide** — sort complètement de la liste, quel que soit le niveau d'imbrication, et place le curseur en texte normal à la racine de la page.

La distinction est volontaire : Backspace et Maj+Tab permettent de remonter progressivement les niveaux, tandis qu'Entrée sur une ligne vide est un raccourci pour quitter la liste d'un coup.

### Listes de tâches

Les listes de tâches Markdown (syntaxe `- [ ] tâche` et `- [x] tâche`) sont rendues avec des cases à cocher interactives. Cocher ou décocher une case met à jour le fichier Markdown immédiatement — sans modifier manuellement le `[x]`.

### Repliement de sections

Chaque titre (H1 à H6) affiche un chevron à sa gauche au survol. Cliquer sur ce chevron replie ou déplie la section correspondante :

- **Replié** — tous les blocs entre ce titre et le prochain titre de niveau supérieur ou égal sont masqués. Le chevron pointe vers la droite et reste visible en permanence pour indiquer qu'une section est cachée.
- **Déplié** — le contenu est visible, le chevron pointe vers le bas.

Le repliement est purement visuel : il ne modifie pas le markdown et est réinitialisé à l'ouverture d'une note. Si le curseur se trouve dans une zone sur le point d'être repliée, il est automatiquement déplacé juste avant.

### Correction orthographique et grammaticale

Un correcteur local (hors-ligne, français) souligne les fautes directement dans l'éditeur :

- **Orthographe** — souligné en rouge.
- **Grammaire** — souligné en bleu.

La vérification démarre **dès l'ouverture d'une note** (la partie visible d'abord, puis le reste), sans qu'il soit nécessaire de taper. Pendant l'édition, seuls les passages modifiés sont revérifiés.

**Corriger une faute.** Cliquer sur un mot souligné ouvre un petit menu listant les corrections proposées. Cliquer sur une suggestion remplace le mot. Le menu se ferme si l'on clique ailleurs, appuie sur Échap, ou fait défiler la page.

**Ignorer un mot.** Pour les fautes d'orthographe, le menu propose aussi **« Ignorer ce mot »**. Le mot est alors ajouté à un dictionnaire propre au vault et n'est plus jamais souligné (dans toutes les notes). Cette liste est partagée par tous les appareils via le fichier de configuration du vault.

**Gérer les mots ignorés.** Dans les réglages, onglet *Éditeur*, le bouton **« Consulter les mots ignorés »** (visible uniquement lorsque le correcteur est activé) ouvre une vue dédiée : liste alphabétique avec champ de recherche, où l'on peut **retirer** des mots (l'ajout se fait via le menu de correction). Retirer un mot le fait à nouveau souligner s'il reste fautif.

**Activation.** Le correcteur s'active/désactive dans les réglages, onglet *Éditeur*.

---

## Glisser-déposer

### Réorganisation interne (drag & drop dans le vault)

Les notes, médias et dossiers du vault sont réorganisables par glisser-déposer directement dans l'explorateur de fichiers. Pour déplacer un élément :

1. Maintenir le clic sur une note ou un dossier et commencer à glisser — un aperçu flottant apparaît avec le nom de l'élément.
2. Glisser vers le dossier de destination, qui se colore en ambre au survol.
3. Relâcher pour effectuer le déplacement.

Le renommage des chemins est automatiquement propagé : les références à la note dans les autres notes (`__Base__`, `__Children__`, etc.) sont mises à jour. Si une note déplacée était ouverte, elle reste active à son nouveau chemin. Appuyer sur **Échap** pendant le glisser annule l'opération.

**Déplacement de plusieurs éléments.** Maintenir **Maj** et cliquer sur les notes ou médias à sélectionner — tous les éléments entre le premier et le dernier sélectionné sont inclus dans la sélection (plage visuelle, y compris le contenu des dossiers ouverts). Une fois plusieurs éléments sélectionnés, glisser l'un d'eux déplace l'ensemble vers la destination. Le ghost affiche le nombre d'éléments sélectionnés. Cliquer sans Maj efface la sélection.

### Import depuis l'explorateur de fichiers (desktop)

Il est possible de faire glisser des fichiers et dossiers depuis le Finder directement dans la fenêtre Lueurs pour les importer dans le vault.

- **Notes `.md`** — copiées dans le dossier cible. Les champs système (`__Type__`, etc.) sont ajoutés automatiquement au frontmatter.
- **Fichiers médias** (images, audio, vidéo, PDF) — copiés tels quels dans le dossier cible.
- **Dossiers** — importés récursivement avec leur structure complète. Une note `__folder__` est créée pour chaque dossier importé ; si le dossier source en contenait déjà une, son contenu est préservé. Les sous-dossiers et leurs médias sont importés de la même manière.

Glisser sur un dossier dans l'explorateur copie dans ce dossier ; glisser sur la zone vide copie à la racine du vault. Plusieurs fichiers ou dossiers peuvent être glissés simultanément.

---

## Fichiers médias

Lueurs affiche et lit les fichiers images, audio, vidéo et PDF présents dans le vault, directement dans l'interface.

### Formats supportés

| Type | Extensions |
|---|---|
| Image | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg` |
| Audio | `.mp3`, `.m4a`, `.wav`, `.ogg`, `.aac` |
| Vidéo | `.mp4`, `.mov`, `.webm` |
| PDF | `.pdf` |

### File tree

Les fichiers médias apparaissent dans l'explorateur à la suite des notes (`.md`), avec une icône distincte selon leur type. Leur nom est modifiable en place (double-clic sur le nom), ce qui renomme le fichier sur le disque. Le menu contextuel (clic droit / appui long) permet de révéler, importer ou supprimer un fichier média comme pour les notes.

Les fichiers médias ne sont pas filtrés par Lueurs — tous les fichiers de format reconnu présents dans le vault sont visibles.

### Visionneuse

Cliquer sur un fichier média l'ouvre dans la visionneuse intégrée, à la place de l'éditeur. La visionneuse affiche :

- **En-tête** : type et extension du fichier, titre éditable. Modifier le titre renomme le fichier sur le disque.
- **Image** : affichage direct, taille naturelle limitée à la zone visible.
- **Audio** : lecteur avec waveform, bouton play/pause, barre de progression cliquable. Le design est identique au bloc audio intégré dans les notes.
- **Vidéo** : lecteur vidéo avec contrôles natifs du navigateur.
- **PDF** : rendu dans un cadre intégré.

---

## Menu Fichier (desktop, macOS)

Le menu **Fichier** de la barre de menu macOS donne accès à trois actions rapides :

### Importer des fichiers ou dossiers…

Ouvre le sélecteur de fichiers natif macOS, qui permet de choisir un ou plusieurs fichiers et/ou dossiers à importer. Les éléments sélectionnés sont importés à la racine du vault, avec la même logique que le glisser-déposer depuis le Finder (notes, médias, dossiers récursifs).

### Révéler dans le Finder

Ouvre le Finder et sélectionne la note ou le fichier média actuellement ouvert. Si rien n'est ouvert, ouvre le vault.

### Supprimer la note

Déplace la note actuellement ouverte vers la corbeille du Finder.

---

## Menu contextuel (clic droit / appui long)

Un menu contextuel natif est disponible sur chaque élément de l'explorateur de fichiers.

**Desktop** — clic droit sur une note, un média ou un dossier.

**Mobile** — appui long sur une note ou un dossier.

### Actions disponibles

| Action | Comportement |
|---|---|
| **Renommer** (mobile) | Ouvre un champ de saisie pour renommer l'élément |
| **Importer des fichiers ou dossiers…** | Ouvre le sélecteur de fichiers natif. La destination est le dossier cliqué (si clic droit sur un dossier) ou le dossier contenant la note/média (si clic droit sur un fichier) |
| **Afficher dans les Fichiers / Révéler dans le Finder** | Ouvre l'explorateur système et sélectionne l'élément |
| **Partager** (mobile) | Partage via le menu natif iOS/Android |
| **Mettre à la poubelle / Supprimer** | Supprime l'élément. Pour les dossiers non vides, une confirmation est demandée |

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
