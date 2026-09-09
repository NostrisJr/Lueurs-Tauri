import { useLayoutEffect, useRef, useState } from "react";

/**
 * Hauteur mesurée (px) du contenu pointé par le ref renvoyé, pour piloter une
 * transition CSS `height` classique (0 ↔ hauteur mesurée) plutôt que
 * grid-template-rows 0fr↔1fr : sous WebKit (webview Tauri), ce dernier ne
 * s'anime pas de façon fiable dans le sens 0fr→1fr — la transition saute
 * directement à la taille finale au lieu d'animer, uniquement à l'ouverture
 * (la fermeture, 1fr→0fr, s'anime déjà correctement). Une transition
 * `height` vers une valeur en px connue n'a pas ce problème, dans les deux
 * sens.
 *
 * Le contenu mesuré ici est statique (switcher Texte/Nombre, décimales/
 * unité), donc mesurer une fois par ouverture suffit — pas besoin de
 * ResizeObserver.
 *
 * `height` est remise à 0 à la fermeture (pas seulement mesurée à
 * l'ouverture) : sinon, à partir de la 2e ouverture, la valeur mesurée est
 * déjà en cache et identique — `setHeight` n'a alors plus rien à changer
 * (bail-out React sur Object.is), donc pas de re-render supplémentaire avant
 * que `mounted` ne déclenche la transition. Ce webview a besoin de ce
 * render/paint en plus pour enregistrer le "0" de départ ; sans lui, la
 * transition saute directement à la taille finale au lieu d'animer.
 */
export function useAnimatedHeight(active: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (!active) {
      setHeight(0);
      return;
    }
    const content = contentRef.current;
    if (content) setHeight(content.scrollHeight);
  }, [active]);

  return { contentRef, height };
}
