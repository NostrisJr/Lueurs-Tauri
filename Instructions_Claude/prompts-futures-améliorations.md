propriétés listes
dans un tempalte, les propriétés n'ont pas de type définit (sauf pour certaines propriétés sysème). Par exemple, on ne peut pas contraindre une propriété au type nombre, texte ou que sais-je. 

en revanche, la syntaxe suivante permet de créer, depuis le template, une liste de valeurs que les héritiers d u template devront prendre.
nom_de_la_propriété : $$BUTTON([valeur1;valeur2;valeur3],default_value)$$
les héritiers du tempalte verront alors, dans leur frontmatter ou dans les bases, une pill avec un dropdown menu permettant de choisir la valeur prise par l'enfant. le but est de réutiliser la synatxe des formules déjà existante, pour simplifier les choses d'un point de vue utilisateur, et de voir cela comme une nouvelle fonction, avec une syntaxe particulière. le paramètre default_index désigne la valeur assignée par défaut aux enfants (avant que cela soitr changé) et peut être différente des valeurs du tableau (comme un placer holder). en outre, il faut que les enfants considèrent cela comme une propriété contrainte (et non forcée), et qu'ils stockent la valeur prise en dur dans le frontmatter, mais il convient der vérifier si la valeur est bien permise par le template.

points d'attention : gérer les renommage des valeurs possibles, dans le tempalte. quand une valeur possible est renommée, il faut que ça se répercute sur tous les héritiers qui auraient cette valeur là choisie.

à discuter : 
je ne sais pas si le format proposé pour le template est le meilleur, ou si il faudrait discocier cela de la logique de calcul.

code calculé inline
dans les propriétés, il y a déjà la possibilité de référencer d'autre notes et de faire des calculs dessus $$ref(note).propriété + 2$$ par exemple. je voudrais créer un nouveau style de texte markdown, qui serait délimité par les mêmes annotations $$ et qui permettrait de faire ce genre de calculs. ce doit être un type inline, mais attention, il y a déjà eu un certain nombre de soucis avec cela (position du caret sortant nomtamment, cf la documentation technique et ta mémoire à ce sujet). je ne sait pas si c'est possible de le faire en mark et pas en noeud prose mirror mais ça serait sans doute l'idéal