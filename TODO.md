# Bugs/TODO actuels à soumettre à Claude : 
- [x] Faire en sorte que renommer un template ne casse pas le lien avec la base. Plus précisément : quand j'ai renommé le dossier contenant les templates, ça a cassé le path... donc ça va être un peu touchy a gérer
- [ ] dans le note header, le nom ne se troncature pas si il est trop long
- [x] régler le pb des __ dans les types. Les proposer en dropdown
- [ ] vérifier l'appartenance automatique à une base via l'héritage d'un template. Je sais pas si c'est pertinent
- [ ] Rajouter un .lueurs.config à la racine pour marquer la version et avoir une ancre de relativisation des paths.
- [x] Dans les agrégations et calculs : 
  - [x] implémenter les références cross notes
  - [ ] ~~rendre le self optionnel~~ => je ne sais pas pourquoi mais ça casse tout 
  - [x] arrondir de manière raisonnable les résultats des formules
- [ ] points UI : 
  - [ ] un resize pour la sidebar (avec idéalement une icone de collapse à la Apple) => il y en a une, mais qui n'est draggable qu'au niveau de la barre de recherche
  - [x] changer les icones en fonction du type de la note
  - [ ] diminuer l'indentation des strates de dossier
  - [ ] Rajouter dans la doc le fait que le template qui reste dans la note est un comportement fait exprès, proposer de supprimer les références à la suppression d'un tempalte, et le marquer en barré dans le cas contraire
    - [ ] idem à la suppression d'une base
  - [x] renommer la colonne d'un tableau ne fonctionne mais ça casse le frontmatter des agrégation
  - [ ] réfléchir à si c'est pertinent d'afficher le calcul dans le frontmatter (et nommer le type d'agrégation qui est effectué...) Mais de toute façon c'est une dynamique qui sera utile pour les références croisées. et en tout cas mettre à jour la doc pour pouvoir appeler les agrégations sans paniquer si elles ne sont plus affichées dans le frontmatter => si elles sont affichées, devraient-elles être modifiables ?
  - [ ] On me parle d'un bug en cas de référence croisée (A = self.B et B = self.A)
  - [ ] Se noter qqp que ce qui provoquait les bugs dans le dnd externe était le fait d'avoir les outils développeurs ouverts... et vérifier que claude a pas overkill le patch pour un problème aussi basique
- [x] Nettoyer les logs en logger
- [ ] Vérifier l'usage presque systématique des usecallback par claude
- [x] quand on crée une prop sans renommage et sans valeur, on passe dans l'éditeur et ça supprime la prop
- [x] rajouter le fait que fermer un onglet nous ramène au précédent utilisé ouvert, et non au plus proche
- [x] faire un fichier de setup, pour les gens qui voudraient le setup eux même (big up à notre ami veilleur)
- [ ] je pense que la sauvegarde se fait trop vite (notamment quand on est en train d'effacer... peut-être un debounce à revoir)

# Roadmap précise
- [x] intégration modules divers:
  - [x] Audio :
    - [x] ~~avec lien~~
      => ça ne marchera pas, car Milkdown escape automatiquement les caractères [] et () pour permettre de les utiliser dans l'écriture. Et on se sert des raccourcis/Commandes pour avoir des liens en bonne et due forme. Je pense que c'est le meilleur comportement
    - [x] drag and drop
    - [x] copier/coller
  - [x] image :
    - [x] ~~avec lien~~
      => ça ne marchera pas pour la même raison que les audios
    - [x] drag and drop
    - [x] copier/coller
    - [x] ~~régler le bug de la handle qui ne s'affiche pas au moment de l'insertion, mais seulement après avoir rechargé la note~~
      - un peu compliqué : il faut réussir à re-render le markdown au bon moment, après l'insertion du noeud, mais c'est async et on n'a visiblement pas de promesse très claire.
- [ ] Essayer de vérifier ce que les paths changent lors du passage à un autre appareil et régler la disparité des chemins (gérer les paths relatifs en fonction du path de la note courante et du path racine avec convertFileSrc() ?)
- [x] champ __type__ obligatoire dans tous les frontmatters
  - [x] le rajouter si il n'est pas présent au parsing de la note
  - [x] Gestion du typage automatique __note__ ou __folder__ au parsing, pour respecter la convention de make.md
  - [x] mettre qqp un fichier référençant les types permis
  - [x] effacer visuellement les tirets __ ?
- [x] Dossier avec espace d'écriture, comme nativement fait par Notion, et apporté par Make.md
  - [x] Gérer la possible duplicité des notes __folder__ => les notes folder n'ayant pas le même nom que le dossier parent direct sont visibles
  - [x] Cacher les notes __folder__ ? Seulement celle du même nom que le dossier ? => seulement si même nom que le dossier
  - [x] Bien renommer la note en même temps que le fichier
  - [x] Faire attention aux cas de renommage extérieur à l'application. Fonctions de re-typage automatique avec invite utilisateur => Si on modifie en dehors de l'application, on casse tout et c'est de notre faute
- [ ] pour les notes __base__
  - [x] gérer l'héritage automatique de la propriété __Children__ pour les notes de __base__
  - [x] gérer la mise à jour des chemins en cas de déplacement des notes enfant.
  - [ ] fonction de rafraîchissement des enfants en reparsing complet du coffre
  - [ ] gérer la résolution des notes introuvables en cas de refresh
  - [x] donner la possibilité de cliquer sur la note dans le frontmatter yaml, pour l'ouvrir dans un nouvel onglet
- [ ] Remettre en place le fait de pouvoir drag and drop les blocs, à la Notion (ça s'est cassé avec le fait de drag and drop des images/audio je crois)
- [x] mettre plusieurs onglets
- [ ] un bug avec baseDir dès qu'il intervient dans le code, on se retrouve à typer avec any et c'est bizarre
- [x] Masquer les propriétés système "inutiles", genre les colonnes kanban, les clefs... (c'est surtout dans kanban)

# FileTree et associés
- [x] régler la disparité entre nom du fichier et première ligne
- [x] rendre invisible les fichiers destinés à la présentation du dossier (Make.md like)
- [ ] rendre invisible le vault racine
- [x] drag and drop
- [ ] multi-sélection
- [ ] menu local
- [ ] rajouter le support des documents non .Md (images, pdf, audios, vidéos)
- [x] Vérifier ce qu'il se passe quand on donne un nom déjà donné

# Fonctionnalités plus (voire trop) larges
- [x] Gestion des propriétés
  - [x] Champs éditables en frontmatter
  - [x] types de propriétés
  - [x] relations avec les bases
  - [x] relation avec les Kanban
- [x] Kanban
  - [x] drag and drop
- [x] Tables/bases
  - [x] agrégations, fonctions
- [ ] Types
  - [x] templates
  - [x] héritage
  - [ ] ~~recherche par type~~ => ça date de mes délires de prise de note orienté objet, mais je suis pas certain que ça soit utile.
    - [ ] Recherche par héritage de tempalte ?
- [ ] Mode sombre
- [ ] des raccourcis clavier
