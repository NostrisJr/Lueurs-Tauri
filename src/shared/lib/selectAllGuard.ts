// Cmd+A hors d'un champ de saisie sélectionnerait toute l'UI (sidebar,
// onglets…) : le navigateur n'a pas d'éditeur ciblé à qui l'appliquer.

type TargetLike = { tagName: string; isContentEditable?: boolean };

export function isTextEditingTarget(target: TargetLike | null): boolean {
  if (!target) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable === true
  );
}

export function isSelectAllShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return (
    e.key.toLowerCase() === "a" &&
    (e.metaKey || e.ctrlKey) &&
    !e.shiftKey &&
    !e.altKey
  );
}
