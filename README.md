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
