# Lueurs - A Tauri Markdown editor opinionated just for me
Le but est d'avoir une application légère et efficace, sans recourir à une tonne de plugins qui ne marchent pas bien entre eux. Ceci n'a pas vocation à être un outil pour tout le monde, mais bien juste pour moi, ou ceux qui auraient exactement les mêmes goûts, contraintes et usages

# POC - 13/02/2026
Un POC full vibe codé comme on les aime. Tout est entassé dans 3 fichiers léviathans, sûrement pas optimisé, certainement pas propre, mais c'est une base. Ce qui a été fait :
- Éditeur de Markdown par Milkdown, Crepe, sans subtilité ni stylisation
- Choix d'un dossier racine, et affichage de l'arborescence infinie, à partir du nom du fichier:
> à faire: 
> - régler la disparité entre nom du fichier et première ligne
> - rendre invisible les fichiers destinés à la présentation du dossier (Make.md like)
> - rendre invisible le vault racine
> - drag and drop
> - multi-sélection
> - menu local

- Édition et sauvegarde des documents en markdown github-flavored
- UI basique

# Documentation

## Propriétés
La notation __Mot__ (entre doubles tirets bas _, avec majuscule) est réservée aux champs systèmes, ou par défauts. La notation __mot__ (entre doubles tirets bas _, sans majuscule) est réservée aux valeurs par défaut que peuvent prendre ces champs.

### Type
L'objectif de Lueurs est de proposer une prise de note à la limite de l'orienté objet, avec un typage et un héritage des propriétés (et/ou du template ?)

Le choix a donc été fait d'un champ __Type__ obligatoire dans le frontmatter de chaque fichier (rajouté automatiquement au parsing si besoin). Les 2 types par défaut sont __note__ et __base__.

#### __note__
Le type par défaut et sans doute celui auquel on pense. Une note en markdown, tout ce qu'il y a de plus logique.

##### __template__
Un type qui hérite de __note__. Il s'agit d'une note qui pourra être utilisé comme template, en contraignant les propriétés des notes auxquelles elle sera attribuée. Se passe en argument de la propriété __Template__ d'une note __note__, __folder__ ou __base__.

##### __folder__
Hérite de __note__. Ces notes permettent de caractériser la vue "note" d'un dossier : le comportement natif de Notion, où chaque note est un dossier, contenant des notes enfant, et présentant un espace d'édition de texte, d'image, de tout ce qu'on veut

#### __base__
Ces notes permettent d'avoir à la fois des bases, et des Kanban/Trello/unJourPeutÊtreCalendrier. Quand une note est de type __base__, elle hérite automatiquement de la propriété __Children__, qui est un string sous forme de json regroupant tous ses enfants. Un bouton "refresh" permet de reparser tout le vault et de mettre cette liste à jour.

le __Type__ __base__ crée automatiquement la propriété __Template__ pour la note __base__ concernée. Il n'est pas obligatoire d'avoir un template, mais c'est évidemment fortement recommandé au vue du principe de fonctionnement d'une base.

### Base
L'objectif est de régler un double problème : la compatibilité avec d'autres logiciels de prise de note (notamment obsidian) et le fait d'éviter de reparser tous les fichiers du coffre à chaque fois qu'on veut voir qui est où.

Une même note peut "appartenir" (être reconnue) par plusieurs bases. La propriété __Base__ peut-être créé par l'utilisateur, et recevoir en argument un array de notes de __Type__ __base__. 

Quand une nouvelle __base__ parente est associée à une note (on rajoute une note de __Type__ __base__ à la propriété __Base__ d'une note), son chemin absolu est automatiquement ajouté à la propriété __Children__ de la __base__ parente.

La création du champ __Base__ rajoute automatiquement le __Template__ de la base aux __Template__ de la note.

### Template
#### Pour les __note__
un array de notes de __Type__ __template__, qui permet de contraindre les propriétés d'une note (__note__ et donc __folder__, qui en hérite). Les propriétés présentent dans la/les note(s) de __Type__ __template__ listée(s) devront automatiquement être présentes dans les propriétés de la note.

#### Pour les __base__
un array de notes de __Type__ __template__, qui permet de contraindre les propriétés des notes listées dans __Children__, et non les propriétés de la base elle même