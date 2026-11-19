# Cahier des charges — Éditeur Lueurs (migration Swift)

8 novembre 2026 · Théophile Donato

## Contexte et décisions

L'éditeur Swift (macOS + iOS) reprend à l'identique le format et les fonctions de l'éditeur Milkdown actuel, sur TextKit 2 natif, en supprimant tout le code qui simulait un comportement Apple. La parité passe avant toute nouveauté.

**Pourquoi migrer.** Lenteur au démarrage et à l'ouverture des notes (l'éditeur Milkdown est remonté à chaque changement de note), accumulation de micro-latences, et une ergonomie Apple « simulée » jamais tout à fait juste (caret dessiné en JS, menu contextuel reconstruit, correcteur ponté en Rust). Android est abandonné.

**Décisions déjà prises (nov. 2026).**

- **Contrat dur : le vault reste des fichiers `.md`.** L'app Tauri et l'app Swift doivent pouvoir ouvrir le même vault en même temps sans se corrompre.
- **Markdown = source de vérité**, modèle Bear/Panda : le buffer de l'éditeur *est* le texte markdown. Le style est appliqué par attributs, de façon incrémentale ; les marqueurs (`#`, `**`, `==`…) sont masqués hors de la ligne active.
- **Pas de clone de ProseMirror en Swift.** Pas d'arbre de nœuds parallèle au texte : une commande (gras, liste, titre) est une édition du texte.
- **Blocs riches** (image, audio, formule) rendus par `NSTextAttachmentViewProvider`, la source markdown restant dans le buffer.
- **Parsing** via `apple/swift-markdown` complété de parseurs maison pour les extensions Lueurs ; **Rust conservé via UniFFI** pour Typst et la propagation de templates ; logique métier dans un package `LueursCore` testé d'abord.
- **Plan B** si TextKit 2 cale sur les longues notes : CodeMirror 6 en live-preview dans une `WKWebView` persistante (même modèle « texte = vérité », donc même cahier des charges).

**Lecture de ce document.** Les sections 2 et 3 fixent le contrat (format et fonctions) ; la section 4 liste ce qu'il ne faut **pas** porter ; la section 5 ce qu'il faut reconstruire.

## Modèle de document

Une note = un fichier `.md` : frontmatter YAML puis corps markdown. L'éditeur ne travaille que sur le corps ; le frontmatter est édité par le panneau Propriétés, hors buffer.

**Exigences.**

1. **Aucune réécriture non demandée.** Ouvrir puis fermer une note sans la toucher ne modifie pas le fichier (octet pour octet). Une frappe ne modifie que la plage tapée : pas de re-sérialisation globale, pas de normalisation des puces, de l'emphase ou des échappements. C'est le gain principal du modèle « texte = vérité » face à remark-stringify.
2. **Tolérance en lecture** : tout ce que Milkdown a écrit jusqu'ici doit s'afficher correctement (fichiers déjà normalisés par remark : `*`/`_`, `\[`, `<chemin avec espaces>`, `~~barré~~`).
3. **Frontmatter préservé** : champs système `__Type__`, `__Template__`, `__Base__`, `__Children__`, `__View__`, `__DisplayMode__`… relus et réécrits avec le même format (tableaux YAML, chaînes JSON entre guillemets simples pour `__KanbanColumns__` / `__TableColumns__`), compatible Obsidian.
4. **Chemins dans le corps toujours relatifs à la racine du vault** (images, audio, liens de note, `ref()` de formule). Résolution en chemin absolu uniquement à l'affichage, jamais persistée.
5. **Écriture disque** après 1 s d'inactivité et à la fermeture / mise en arrière-plan ; les écritures de l'app sont ignorées par le watcher (équivalent de `writingPathsRegistry`).
6. **Coexistence** : une modification externe (autre app, iCloud) recharge la note ouverte sans perdre le curseur ni l'historique d'annulation si le texte local n'a pas changé depuis la dernière écriture ; sinon, conflit signalé, jamais d'écrasement silencieux.
7. **Mutations de fichiers** (renommer, déplacer, supprimer) : réindexation de toutes les références entrantes, comme `useFileReferences` aujourd'hui (liens, images, audio, champs chemin du frontmatter, `ref()`).

## Périmètre fonctionnel

L'éditeur couvre CommonMark + GFM et six extensions Lueurs. Chaque ligne du tableau est un contrat de format : la syntaxe sur disque ne change pas.

| Élément | Syntaxe sur disque | Rendu hors ligne active | Saisie / commande |
| --- | --- | --- | --- |
| Titres H1–H6 | `# …` à `###### …` | `#` masqués, révélés quand le curseur entre dans le titre | `⌘⌥1`…`6`, `⌘⌥0` = paragraphe |
| Gras, italique | `**x**`, `*x*` / `_x_` | marqueurs masqués | `⌘B`, `⌘I` |
| Barré | `~~x~~` (un `~` seul = texte) | marqueurs masqués | `⌘⇧S`, saisie `~x~` → `~~x~~` |
| Code inline | `` `x` `` | « boîte » (fond, police réduite) | `⌘E`, `` ⌘` `` |
| Didascalie | `\|\|x\|\|` | italique entre pipes visuels, sans marque imbriquée | `⌘D`, saisie `\|\|x\|\|` |
| Surlignage | `=={couleur}x==`, couleur ∈ yellow, green, blue, red, orange, purple, gray | fond coloré + pastille de couleur au survol | `⌘⇧L` (couleur par défaut des réglages), sous-menu contextuel |
| Lien de note | `[texte](chemin/relatif.md)`, `<…>` si espaces | bleu ; rouge pointillé si cible absente | `[[` ou `[texte](` → autocomplétion ; `⌘⇧K` |
| Lien web | `[texte](https://…)` | lien, ouvert dans le navigateur | idem |
| Formule inline | `$$expr$$` sur une ligne, `ref("chemin.md")` relatif au vault | `ƒ résultat` ; forme humanisée `ref("Nom")` en édition | `$$` ouvre l'éditeur de formule |
| Image | `![alt](chemin "titre")` seule dans son paragraphe | image affichée ; cadre d'erreur si fichier absent | glisser-déposer, menu contextuel, collage |
| Audio | `[titre](chemin.mp3)` seul dans son paragraphe (mp3, m4a, wav, ogg, flac, aac, opus, webm) | lecteur avec forme d'onde, un seul lecteur actif | glisser-déposer, menu, enregistreur |
| Bloc poésie | lignes `§§` ouvrante et fermante, strophes entre elles | marqueurs masqués, vers sans justification | `⌘⇧P`, `§§` seul sur une ligne vide ; `⇧↩` = nouvelle strophe |
| Listes à puces / numérotées | `- `, `1. `, imbrication par indentation | puces / numéros ; tirets en mode livre | `⌘⇧8`, `⌘⇧7` |
| Tâches | `- [ ] x`, `- [x] x` | case à cocher cliquable | `⌘⇧9` |
| Citation | `> …` | barre latérale | `⌘⇧B` |
| Bloc de code | ```` ``` ```` | bloc grisé (normal) ; dans le flux, `\| code \|` (livre) | `⌘⇧E`, `⌘⌥C` |
| Ligne horizontale | `---` | filet | `⌘⇧H` |
| Tableau GFM | `\| a \| b \|` | grille | menu contextuel « Insérer un tableau » |

**Toutes les commandes de structure sont des bascules** : réappliquer le raccourci retire la structure, et passer d'une structure à l'autre (titre → liste, citation → tâche) se fait en une seule étape d'annulation.

**Fonctions d'édition à conserver.**

- Recherche / remplacement (`⌘F`), surlignage de toutes les occurrences du mot sélectionné.
- Repliement de sections par chevron au survol d'un titre (visuel seulement, réinitialisé à l'ouverture).
- Carte du document (`DocumentNavigator`) : titres et blocs pour naviguer.
- Modes d'affichage normal / livre (`__DisplayMode__`), avec mode par défaut réglable et justification optionnelle.
- Correcteur français : orthographe en rouge, grammaire en bleu, mots ignorés par vault dans `.lueurs/config.json`.
- Export PDF / aperçu Typst à partir du markdown (le convertisseur `proseToTypst` devient un convertisseur markdown → Typst).

**Relevé du vault (8 nov. 2026, 221 notes).**

- Saut de ligne forcé : `\` en fin de ligne (15 notes) ; deux espaces dans 1 note. On écrit `\`, on lit les deux.
- Puces `*` (sortie remark, 57 notes) : un nouvel item reprend la puce de sa liste.
- `<br />` seul dans un paragraphe (23 notes) = ligne vide écrite par Milkdown : affichée comme ligne vide, conservée.
- Largeur d'image en commentaire HTML collé à l'image : `![](x.png)<!-- {"width":255} -->`. À lire et à conserver.
- Échappements (`\*`, `\_` dans l'alt d'image, `!\[\[image.png]]`) : affichés, jamais réécrits.
- Anciens chemins d'image encodés en `%20` et relatifs **à la note** (pas au vault), parfois cassés : à résoudre en lecture, sans réécriture.
- Audio au titre vide : `[](resources/audio/….aac)`.
- Fin de fichier : 33 notes sans `\n` final, 48 avec `\n\n` : aucune normalisation.
- Tableaux GFM (3 notes), chemins `<…>` (1 note), commentaires HTML `<!-- Column 1 -->`.
- Note la plus longue : 19 133 mots (`CS - Scolaire/Rapport intermédiaire.md`), référence pour la cible de frappe.

## Émulations à ne pas porter

Une vingtaine de mécanismes de l'éditeur actuel ne font qu'imiter un comportement Apple ou contourner WebKit / ProseMirror. Ils ne sont **pas** à réécrire : la règle est d'utiliser le composant natif et d'accepter son comportement, même s'il diffère légèrement de la version Tauri.

| Domaine | Émulation actuelle (fichiers) | Remplacée par |
| --- | --- | --- |
| Caret | Caret dessiné en JS : `div` positionné par `coordsAtPos`, hauteur `fontSize × 1.3`, transition 90 ms, clignotement CSS, correctif `transitionend` sur les `#` animés, cas de l'atome en fin de bloc (`customCaretPlugin`) | Caret natif ; sa hauteur se règle par le style de paragraphe (`lineHeightMultiple` vs interligne), pas par du dessin |
| Caret aux bords des styles | `crossBoxEdge`, `escapeInlineMarksPlugin`, `stickyInlineBoxPlugin`, `caretSide` : deux emplacements visuels pour une même position aux bords du code, de la didascalie, du surlignage | Disparaissent : les délimiteurs (`` ` ``, `\|\|`, `==`) sont des caractères réels du buffer, donc « dedans » et « dehors » sont deux positions distinctes |
| Liens | `link-boundary-plugin` (lien rendu non inclusif à la main) | Disparu : la frontière est le `)` |
| Raccourcis | `codeBasedShortcutsPlugin` (AZERTY : `event.key` vs `event.code`), désactivation du keymap titres du preset, ordre de précédence des keymaps | `keyEquivalent` des menus `NSMenu` / `UIKeyCommand`, qui gèrent la disposition clavier |
| ⌘A | `selectAllGuard` / `useSelectAllGuard` (⌘A sélectionnait toute l'UI) | Disparu : chaîne de répondeurs native |
| Menu contextuel | Menu Tauri reconstruit, raccourcis écrits dans le libellé (`"Gras\t⌘B"`), instantané de sélection car le menu vole le focus (`useContextMenu`) | `menu(for:)` sur macOS, `UIEditMenuInteraction` sur iOS : raccourcis affichés, sélection conservée, entrées système (Recherche, Traduire, Services, Writing Tools) incluses |
| Popovers | Positionnement manuel (`popupPosition`, `scrollPosIntoViewLikeEditing`), popover du correcteur fermé au scroll, pastille de surlignage en widget qui suit le scroll | `NSPopover` / popover UIKit ancré sur `firstRect(for:)` du texte, qui suit le défilement |
| Défilement | `useCaretScroll` (marges sous l'en-tête, cas de la ligne vide à hauteur 0) | `scrollRangeToVisible` + `contentInsets` / safe area |
| Clavier virtuel (iOS) | `useKeyboard` via `visualViewport`, `disableInputAccessoryView`, barre de formatage flottante positionnée à la main, scroll parasite au focus hors écran, polices ≥ 16 px contre le zoom Safari | `inputAccessoryView` et `keyboardLayoutGuide` |
| Listes sur mobile | `mobileListDeletePlugin` (Backspace livré en `beforeinput`, `<li>` reconstruit qui perd sa coche) | Disparu : toute édition passe par `shouldChangeTextIn` ; seul le comportement décrit en section suivante est à coder |
| Liens sur mobile | Appui long reconstruit (`useMobileLinkLongPress`), clic de navigation supprimé après l'appui | Interactions d'éléments de texte UIKit (action principale + menu d'un lien) |
| Correcteur | Pont Rust `macos_spellcheck.rs` (écriture des NSUserDefaults pour activer l'autocorrection, suggestions réinjectées dans le menu), tap mobile sur mot souligné (`useMobileSpellTap`, `MobileSpellMenu`), mapping octets UTF-8 ↔ positions | Correction native de `NSTextView` / `UITextView` : soulignement, suggestions dans le menu, apprentissage du mot |
| Recherche | Barre `⌘F` maison (`SearchBar`, `MobileSearchBar`, `searchPlugin`) | `NSTextFinder` (macOS), `UIFindInteraction` (iOS 16+) |
| Annulation | Plugin `history`, Annuler / Rétablir dans le menu burger mobile | `UndoManager` : menu Édition, secouer, geste trois doigts |
| Audio | Web Audio pour éviter ~1 s de latence `AVAudioSession`, arrêt global, capture de la barre espace au niveau document, pont `nativeAudioPlayer` | `AVAudioPlayer` préchargé directement |
| Images | `asset://` via `convertFileSrc`, lecture d'octets côté Rust sur Android | Chargement direct depuis l'URL fichier |
| Glisser-déposer | Correction des coordonnées wry, pointer events à la place du DnD HTML5 | Drop natif de la vue texte / `UIDropInteraction` |
| Ouverture de note | Éditeur remonté à chaque note (`key={activeNote.id}`) | Une seule vue texte ; on remplace son stockage de contenu |

**Gains gratuits à ne pas casser** : dictée, autocorrection, remplacements de texte système, Writing Tools, Recherche / Traduire, sélection au trackpad et loupe iOS, Handoff du presse-papiers. Exigence : chacun produit du markdown valide (ex. Writing Tools ne doit pas supprimer un `==` ou un `$$`).

## Comportements Lueurs à reconstruire

Ce qui suit n'existe pas nativement et constitue le cœur du travail. Chaque comportement est une édition du texte, annulable en une étape.

**Affichage des marqueurs.**

- Hors élément actif, les marqueurs (`#`, `**`, `||`, `=={c}`, `§§`, `[`…`](chemin)`) sont masqués ; ils réapparaissent quand le curseur est dans l'élément ou à son bord.
- Révélation sans saut de mise en page perceptible : les `#` d'un titre s'affichent dans la marge gauche (comme le `::before` actuel), pas en décalant le texte.
- En bout de style, la frappe reste dans le style tant que le curseur est avant le délimiteur fermant ; `→` le fait passer après.

**Listes et tâches.**

1. `↩` sur un item non vide : nouvel item du même type (numéro incrémenté, `- [ ] ` pour une tâche).
2. `↩` sur un item vide : sortie de la liste, tous niveaux d'un coup.
3. `⌫` sur un item vide : remonte d'un niveau ; au premier niveau, l'item redevient un paragraphe.
4. `⌫` au début d'un item non vide : fusion avec l'item précédent, sans perdre sa coche.
5. `⇥` / `⇧⇥` : indente / désindente l'item.
6. Clic ou tap sur une case : bascule `[ ]` ↔ `[x]` dans le texte.

**Règles de saisie.** `||x||` → didascalie ; `=={c}x==` → surlignage ; `~x~` → `~~x~~` ; `§§` seul sur une ligne vide → bloc poésie avec curseur dedans ; `$$` → éditeur de formule ; `[[` et `[texte](` → autocomplétion de notes. Aucune règle dans le code inline ni les blocs de code.

**Liens de note.**

- Autocomplétion filtrée à la frappe ; insère `[alias ou nom](chemin.md)`, avec `<…>` si le chemin contient des espaces.
- Clic : ouvre dans l'onglet courant ; `⌘`-clic : nouvel onglet ; lien web : navigateur externe.
- Statut « cassé » recalculé quand l'arbre du vault change, sans édition de la note.
- Éditeur de lien (cible + texte) partagé entre menu contextuel, appui long et `⌘⇧K`.

**Formules inline.** Au repos, `ƒ résultat` à la place de `$$…$$`. Un clic ouvre l'éditeur de formule (forme humanisée `ref("Nom")`, sélecteurs après `ref(`, `.` et `self.`). `↩`, `⎋` ou clic extérieur valident ; une formule vide est supprimée. Le résultat se recalcule quand une note référencée change.

**Surlignage.** Au survol (macOS) ou à la sélection (iOS), une pastille de la couleur ouvre le sélecteur : 7 couleurs + Supprimer. Changer de couleur réécrit `{c}` sur toute la plage contiguë.

**Images et audio.**

- Un bloc média se sélectionne en entier ; `⌫` juste après le supprime (annulable).
- Audio : forme d'onde, lecture / pause, déplacement dans la piste, titre éditable ; `espace` lit le bloc sélectionné ; un seul lecteur actif.
- Dépôt ou collage d'un fichier : copie dans le dossier de ressources du vault, insertion du chemin relatif.

**Collage.** Du markdown collé est conservé tel quel ; du texte riche (page web, Pages) est converti en markdown ; une image du presse-papiers devient un fichier du vault.

**Autres.** Repliement de sections au chevron ; surlignage des autres occurrences du mot sélectionné ; mode livre (EB Garamond, justification optionnelle, alinéa de première ligne, tirets de liste, code dans le flux entre `|`).

## Dictaphone

L'enregistreur produit un fichier audio dans le vault et un bloc audio standard ; aucun format nouveau.

**Comportement à conserver.**

- **Deux modes.** *Insertion* : depuis une note (bouton de l'en-tête), le bloc `[Enregistrement](audio/enregistrement-<horodatage>.<ext>)` est inséré au curseur. *Nouvelle note* (mobile) : note créée dans le dossier dictaphone des réglages, titrée « Nouvel enregistrement N » (premier numéro libre, titre modifiable avant l'arrêt), corps `[titre](<chemin>)`, puis ouverte dans un onglet.
- **Contrôles** : enregistrer, pause / reprise, arrêt (= sauvegarde), annulation ; durée et forme d'onde en direct ; message d'erreur si la sauvegarde échoue.
- **Fichier** : copié dans `audio/` du vault, fichier temporaire supprimé, chemin inséré relatif au vault.
- **iOS** : bouton du Centre de contrôle qui ouvre l'app en mode nouvelle note et démarre l'enregistrement aussitôt ; l'enregistrement continue app en arrière-plan et écran verrouillé.
- **Mobile** : pastille réductible au-dessus du clavier pendant l'enregistrement, pour continuer à écrire.

**Émulations à ne pas porter.**

- Plugin Tauri d'enregistrement maison (pas encore publié, sans `dist/`) et appels `invoke` → `AVAudioRecorder` / `AVAudioEngine`.
- Forme d'onde dessinée en canvas avec couleur relue du thème → vue native alimentée par les niveaux d'`AVAudioRecorder`.
- Glissement vers le bas codé en touch events, confirmation par `window.confirm` → sheet native avec détentes, `confirmationDialog`.
- Panneau desktop qui glisse depuis le haut par animation CSS → panneau ou popover natif.
- Double appel au démarrage automatique contourné par une ref → réception d'un `AppIntent` unique.

## Propriétés et bases

Une note `__base__` affiche une vue Table ou Kanban de ses enfants **à la place** du corps ; toutes les notes ont au-dessus du corps le panneau Propriétés. Les deux partagent les mêmes règles d'édition de propriétés et font partie de la vue note.

**Panneau Propriétés (frontmatter).**

- Propriétés libres, contraignantes (clé ambre verrouillée), imposées (valeur grisée) selon `__Template__`.
- Boutons `$$ENUM([a;b;c],défaut)$$` affichés en pastilles colorées (couleurs `=={c}valeur==`) avec menu déroulant ; valeur hors liste réécrite avec la valeur par défaut.
- `$$` sur une propriété libre ouvre le panneau Texte / Nombre / Bouton ; roue crantée au survol pour y revenir.
- Formules `$$…$$` (`self.`, `ref()`, `agg`, `round`, `iif`) calculées à l'affichage, jamais persistées évaluées ; mêmes sélecteurs que les formules inline.
- Sur mobile, panneau replié par défaut.

**Vue Table.**

- Une ligne par enfant, une colonne par propriété des templates de la base ; première colonne = titre, renommable.
- Édition en cellule (double-clic), cellules imposées grisées ; largeurs redimensionnables, persistées dans `__TableColumns__`.
- Renommer une colonne renomme la propriété dans les templates et la propage à tous les héritiers.
- Pied de tableau : Comptage, Somme, Moyenne, Min, Max ; persisté dans `__TableAggregations__`, exposé en `__Agg_<col>_<op>__`.
- Mobile : en-tête de colonnes collant.

**Vue Kanban.**

- Colonnes = valeurs d'une propriété contraignante (`__KanbanKey__`, « Groupé par X » modifiable), définies dans `__KanbanColumns__` avec identifiants stables.
- Glisser une carte réécrit la propriété dans le frontmatter de la note ; colonne virtuelle « Sans valeur » (vide la valeur).
- Renommer une colonne réécrit la valeur dans toutes ses notes ; ajout de colonne ; titre de carte renommable ; `⌘`-clic = nouvel onglet.

**Opérations de masse.** Propagation des templates en Rust (via UniFFI), maintenance automatique de `__Children__` à chaque changement de `__Base__`, renommage ou suppression, bouton de reconstruction.

**Émulations à ne pas porter.**

- Glisser-déposer Kanban tactile réécrit à la main (`useMobileReorder`, à la place de `@dnd-kit`), défilement automatique aux bords (`useKanbanEdgeScroll`, `kanbanColumnScroll`) → drag & drop de `UICollectionView` / `NSCollectionView` avec défilement automatique intégré.
- Redimensionnement de colonnes et en-tête collant codés en pointer events et CSS sticky → `NSTableView` (macOS), en-têtes de section épinglés (iOS).
- Popovers de propriétés et listes déroulantes positionnés à la main → `Menu` / `Picker` natifs pour les boutons ENUM.

**Parité requise avant la première version** : une base ouverte dans l'app Swift doit au minimum s'afficher et s'éditer (Table et Kanban), sinon la coexistence sur un même vault n'a pas de sens pour l'usage quotidien.

## Plateformes

Un seul moteur d'édition (stylage, marqueurs, commandes) partagé entre `NSTextView` et `UITextView` sur TextKit 2 ; seules l'entrée et la présentation diffèrent.

| | macOS | iOS / iPadOS |
| --- | --- | --- |
| Commandes | Menu Format de la barre de menus + raccourcis ; menu contextuel | Barre de formatage en `inputAccessoryView` ; menu d'édition ; raccourcis avec clavier physique (iPad) |
| Liens | Clic / `⌘`-clic ; survol = curseur main | Tap = ouvrir ; appui long = menu (ouvrir, modifier, supprimer) |
| Surlignage | Pastille au survol | Pastille quand la sélection est dans le surlignage |
| Recherche | `NSTextFinder` (barre au-dessus du texte) | `UIFindInteraction` |
| Titre de note | En-tête fixe | Titre qui se transforme en barre flottante au défilement (à refaire avec la barre de navigation native) |
| Version minimale | macOS 27 | iOS 27 |

## Exigences non fonctionnelles

**Performance (critères du go/no-go du spike).**

| Mesure | Cible |
| --- | --- |
| Ouverture d'une note de 2 000 mots | < 100 ms jusqu'au premier affichage stylisé |
| Latence de frappe sur une note de 20 000 mots | < 16 ms par caractère (pas d'image perdue) |
| Restylage après une frappe | limité au paragraphe touché (ou au bloc poésie / code englobant) |
| Défilement d'une note avec 30 images | 60 i/s, images chargées à la demande |
| Démarrage à froid jusqu'à la dernière note ouverte | < 500 ms |

**Thème clair / sombre.** Toutes les couleurs passent par des rôles nommés (Asset Catalog avec variantes clair / sombre), reprenant les rôles de `theme.css` : encre, surfaces, lignes, accent, surlignages atténués en sombre, lien cassé. Aucune couleur en dur. Le réglage de thème de l'app peut contredire celui du système.

**Accessibilité.** Taille de texte dynamique, VoiceOver lit le texte sans marqueurs masqués, les médias ont un libellé (alt, titre audio), contraste suffisant dans les deux thèmes.

**Tests.** Le parseur des extensions, les règles de saisie et les commandes (listes, bascules) sont des fonctions pures texte → texte dans `LueursCore`, testées avant d'être branchées à la vue. Corpus de non-régression : un échantillon réel du vault, vérifié octet pour octet après ouverture / fermeture.

**Journalisation.** Messages contextualisés via `os.Logger` (catégorie par module), équivalent de `logger.ts`, destinés à rester.

## Périmètre, acceptation et étapes

**Hors périmètre de la première version.** Android ; nouvelle syntaxe ou nouveau bloc ; édition WYSIWYG des tableaux (édition en texte, rendu en grille hors ligne active) ; animation du caret.

**Critères d'acceptation.**

- [ ] Corpus du vault ouvert / fermé sans aucune différence d'octet.
- [ ] Chaque ligne du tableau Périmètre fonctionnel : rendu, saisie et commande vérifiés sur macOS et iOS, en clair et en sombre.
- [ ] Les six comportements de listes vérifiés au clavier physique et au clavier virtuel.
- [ ] Aucun fichier Swift ne réimplémente une émulation listée (tableau Émulations, sections Dictaphone et Bases).
- [ ] Cibles de performance atteintes sur un Mac et un iPhone de référence.
- [ ] Une note modifiée dans Lueurs Swift se rouvre identique dans Lueurs Tauri, et inversement.

**Étapes.**

1. Finir ce cahier : relever sur le vault les cas limites (saut de ligne forcé, tableaux, chemins à espaces).
2. Spike TextKit 2 de 2 à 3 semaines : stylage incrémental, marqueurs masqués, un attachement image, une formule ; mesure des cibles ; go / no-go, sinon plan B CodeMirror 6.
3. `LueursCore` tests d'abord : parseur des extensions, règles de saisie, commandes de listes et de bascule, références.
4. Shell macOS puis éditeur complet et dictaphone, puis Propriétés et Bases, puis iOS (dont Centre de contrôle).

**Questions ouvertes.**

- Correcteur : correction native seule, ou Hugo conservé pour la grammaire française ?
- ~~Versions minimales~~ : macOS 27 / iOS 27 (décidé le 8 nov. 2026).
