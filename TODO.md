# Roadmap précise
- [x] intégration modules divers:
  - [ ] Audio :
    - [ ] avec lien
    - [x] drag and drop
    - [ ] copier/coller
  - [ ] image :
    - [ ] avec lien
    - [x] drag and drop
    - [x] copier/coller
    - [ ] régler le bug de la handle qui ne s'affiche pas au moment de l'insertion, mais seulement après avoir rechargé la note
- [ ] champ __type__ obligatoire dans tous les frontmatters
  - [ ] le rajouter si il n'est pas présent au parsing de la note
  - [ ] Gestion du typage automatique __note__ ou __folder__ au parsing, pour respecter la convention de make.md
  - [ ] mettre qqp un fichier référençant les types permis
  - [ ] effacer visuellement les tirets __ ?
- [ ] Dossier avec espace d'écriture, comme nativement fait par Notion, et apporté par Make.md
  - [ ] Gérer la possible duplicité des notes __folder__
  - [ ] Cacher les notes __folder__ ? Seulement celle du même nom que le dossier ?
  - [ ] Bien renommer la note en même temps que le fichier
  - [ ] Faire attention aux cas de renommage extérieur à l'application. Fonctions de re-typage automatique avec invite utilisateur
- [ ] pour les notes __base__
  - [ ] gérer l'héritage automatique de la propriété __Children__ pour les notes de __base__
  - [ ] gérer la mise à jour des chemins en cas de déplacement des notes enfant.
  - [ ] fonction de rafraichissement des enfants en reparsing complet du coffre
  - [ ] gérer la résolution des notes introuvables en cas de refresh

# FileTree et associés
- [x] régler la disparité entre nom du fichier et première ligne
- [x] Images
  - [ ] BUG : quand on marque le texte par soi-même, ça ne se rend pas en image
  - [ ] TODO : Claude a sans doute fait qqc de vraiment pas très propre. Essayer d'aller fouiller le code pour voir comment simplifier tout ça
- [ ] rendre invisible les fichiers destinés à la présentation du dossier (Make.md like)
- [ ] rendre invisible le vault racine
- [ ] drag and drop
- [ ] multi-sélection
- [ ] menu local
- [ ] Vérifier ce qu'il se passe quand on donne un nom déjà donné

# Fonctionnalités plus (voire trop) larges
- [ ] Gestion des propriétés
  - [x] Champs éditables en frontmatter
  - [ ] types de propriétés
  - [ ] relations avec les bases
  - [ ] relation avec les Kanban
- [ ] Kanban
  - [ ] drag and drop
- [ ] Tables/bases
  - [ ] agrégations, fonctions
- [ ] Types
  - [ ] templates
  - [ ] héritage
  - [ ] recherche par type

