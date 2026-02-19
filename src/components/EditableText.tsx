import { useState, useRef, useEffect } from "react";

interface EditableTextProps {
    value: string;
    onSave: (newValue: string) => Promise<void>;
    className?: string;
}

export function EditableText({ value, onSave, className = "" }: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

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

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`outline-none truncate ${className}`}
            />
        );
    }

    return (
        <span
            onDoubleClick={() => {
                setEditValue(value);
                setIsEditing(true);
            }}
            className={`cursor-pointer hover:bg-gray-100 truncate ${className}`}
            title="Cliquer pour renommer"
        >
            {value}
        </span>
    );
}