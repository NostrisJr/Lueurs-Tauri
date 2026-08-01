import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { isMobile } from "../lib/platform";

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  clickToEdit?: boolean;
  disabled?: boolean;
}

export function EditableText({
  value,
  onSave,
  className = "",
  clickToEdit = false,
  disabled = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref toujours à jour — permet au cleanup de lire les valeurs courantes
  const stateRef = useRef({ isEditing, editValue, value, onSave });
  stateRef.current = { isEditing, editValue, value, onSave };

  // Desktop uniquement — sur mobile le focus est donné dans le geste utilisateur
  // (voir startEditing), sinon WKWebView refuse d'ouvrir le clavier.
  useEffect(() => {
    if (isMobile) return;
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sur mobile, swipe arrière démonte le composant sans déclencher onBlur.
  // On flush le rename en attente au démontage.
  useEffect(() => {
    return () => {
      const {
        isEditing: editing,
        editValue: val,
        value: orig,
        onSave: save,
      } = stateRef.current;
      if (!editing) return;
      const trimmed = val.trim();
      if (trimmed && trimmed !== orig) {
        save(trimmed).catch(() => {});
      }
    };
  }, []);

  async function handleSave() {
    const trimmed = editValue.trim();

    // Si vide ou inchangé, annuler
    if (!trimmed || trimmed === value) {
      setEditValue(value);
      setIsEditing(false);
      return;
    }

    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      // En cas d'erreur, restaurer la valeur originale
      setEditValue(value);
      setIsEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Mobile : blur d'abord pour refermer le clavier, le save suit via onBlur
      if (isMobile) {
        inputRef.current?.blur();
        return;
      }
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  }

  function startEditing() {
    setEditValue(value);

    if (!isMobile) {
      setIsEditing(true);
      return;
    }

    // iOS n'ouvre le clavier que si focus() a lieu dans le même tick que le geste
    // utilisateur : on force le rendu de l'input avant de le focus.
    flushSync(() => setIsEditing(true));
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Caret en fin plutôt que select() — une frappe accidentelle effacerait tout
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        enterKeyHint="done"
        className={`outline-none caret-amber-400 w-full truncate ${className} items-baseline px-1`}
      />
    );
  }

  // Mobile : un <button> et pas un <span>. iOS n'émet pas toujours de click sur
  // un élément non interactif, et surtout les gardes `closest("button, input…")`
  // des conteneurs parents (MobileEditor) laisseraient passer le tap au travers.
  if (isMobile) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={startEditing}
        className={`truncate min-w-0 text-left bg-transparent ${className} px-1`}
      >
        {value}
      </button>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
    <span
      onClick={!disabled && clickToEdit ? startEditing : undefined}
      onDoubleClick={!disabled && !clickToEdit ? startEditing : undefined}
      className={`truncate ${className} items-baseline px-1 ${disabled ? "" : "cursor-pointer"}`}
      title={disabled ? undefined : "Cliquer pour renommer"}
    >
      {value}
    </span>
  );
}
