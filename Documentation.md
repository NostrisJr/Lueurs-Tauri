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

Hérite de `__note__`. Un template définit un ensemble de propriétés que d'autres notes devront posséder. Les templates sont stockés dans `config/` et apparaissent comme des **types** dans l'interface utilisateur.
// TODO : pas sûr de la phrase précédente. Les tempaltes vont apparaitre dans le champ Template, qui est une propriété standard... donc je dirais que non

### `__base__`

Une base est un agrégat de notes. Elle expose une vue structurée (liste, kanban, etc.) de toutes les notes qui lui sont associées via leur propriété `__Base__`.

---

## Propriétés système

### `__Template__`

Array de chemins vers des notes de type `__template__`. Les propriétés définies dans les templates listés sont automatiquement présentes dans le frontmatter de la note, avec une valeur vide si elles n'ont pas encore été renseignées.

Pour une note `__base__`, `__Template__` contraint les propriétés des notes enfant listées dans `__Children__`, et non les propriétés de la base elle-même.

### `__Base__`

Array de chemins vers des notes de type `__base__`. Indique à quelles bases cette note appartient. Lorsqu'une base est ajoutée à ce champ, le chemin de la note est automatiquement enregistré dans la propriété `__Children__` de la base concernée. Le `__Template__` de la base est également fusionné dans le `__Template__` de la note.

Lorsqu'une base est retirée de ce champ, le chemin de la note est retiré de `__Children__` de la base concernée.

### `__Children__`

Propriété des notes de type `__base__`. Array de chemins absolus vers les notes enfant de la base. Ce champ est géré automatiquement : il est mis à jour dès qu'une note modifie sa propriété `__Base__`, et à la suppression d'une note enfant. Un bouton **Refresh** permet de reconstruire manuellement l'ensemble des `__Children__` du vault en reparsant tous les fichiers, utile notamment après des modifications effectuées depuis un autre logiciel.

```yaml
__Children__:
  - /chemin/absolu/vers/note1.md
  - /chemin/absolu/vers/note2.md
```

---

## Types utilisateur

Les types utilisateur sont des notes de type `__template__` stockées dans `config/`. Ils apparaissent dans l'interface comme des types à part entière, au même titre que `__note__` ou `__base__`. Il est possible de créer de nouveaux types directement depuis Lueurs, ce qui crée la note template correspondante dans `config/`.

---

## Compatibilité Obsidian

Les frontmatters générés par Lueurs sont du YAML standard, lisibles nativement par Obsidian. `__Children__` est un array YAML, pas un objet JSON. Les champs système (`__Type__`, `__Base__`, etc.) apparaissent tels quels dans Obsidian, tirets bas inclus.