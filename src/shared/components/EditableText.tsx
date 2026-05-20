import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  clickToEdit?: boolean;
}

export interface EditableTextHandle {
  startEdit: () => void;
}

export const EditableText = forwardRef<EditableTextHandle, EditableTextProps>(
  function EditableText(
    { value, onSave, className = "", clickToEdit = false },
    ref
  ) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    // Ref toujours à jour — permet au cleanup de lire les valeurs courantes
    const stateRef = useRef({ isEditing, editValue, value, onSave });
    stateRef.current = { isEditing, editValue, value, onSave };

    useEffect(() => {
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
      } catch (error) {
        // En cas d'erreur, restaurer la valeur originale
        setEditValue(value);
        setIsEditing(false);
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        setEditValue(value);
        setIsEditing(false);
      }
    }

    function startEditing() {
      setEditValue(value);
      setIsEditing(true);
    }

    useImperativeHandle(ref, () => ({ startEdit: startEditing }), []);

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`outline-none w-full truncate ${className} items-baseline px-1`}
        />
      );
    }

    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
      <span
        onClick={clickToEdit ? startEditing : undefined}
        onDoubleClick={!clickToEdit ? startEditing : undefined}
        className={`cursor-pointer truncate ${className} items-baseline px-1`}
        title="Cliquer pour renommer"
      >
        {value}
      </span>
    );
  }
);
