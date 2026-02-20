import { useState, useEffect } from "react";
import type { Frontmatter } from "../hooks/useFileTree";

interface FrontmatterEditorProps {
    frontmatter: Frontmatter;
    onChange: (updated: Frontmatter) => void;
}

interface Row {
    key: string;
    value: string;
}

function toRows(frontmatter: Frontmatter): Row[] {
    return Object.entries(frontmatter).map(([key, value]) => ({
        key,
        value: Array.isArray(value) ? value.join(", ") : String(value ?? ""),
    }));
}

function toFrontmatter(rows: Row[]): Frontmatter {
    const result: Frontmatter = {};
    for (const row of rows) {
        if (!row.key.trim()) continue;
        result[row.key] = row.value.includes(",")
            ? row.value.split(",").map((v) => v.trim()).filter(Boolean)
            : row.value;
    }
    return result;
}

export function FrontmatterEditor({ frontmatter, onChange }: FrontmatterEditorProps) {
    const [rows, setRows] = useState<Row[]>(() => toRows(frontmatter));

    // Sync si la note active change (sélection d'une autre note)
    useEffect(() => {
        setRows(toRows(frontmatter));
    }, [frontmatter]);

    function updateRow(index: number, patch: Partial<Row>) {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    }

    function commitRows(updatedRows: Row[]) {
        onChange(toFrontmatter(updatedRows));
    }

    function addRow() {
        const newRows = [...rows, { key: `propriété ${rows.length + 1}`, value: "" }];
        setRows(newRows);
        // Pas de commit immédiat — l'utilisateur va renommer la clé
    }

    function removeRow(index: number) {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        commitRows(newRows);
    }

    if (rows.length === 0) {
        return (
            <button
                type="button"
                onClick={addRow}
                className="block text-xs text-gray-300 hover:text-gray-400 px-4 py-1.5 transition-colors cursor-pointer"
            >
                + Ajouter des propriétés
            </button>
        );
    }

    return (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-1">
            {rows.map((row, index) => (
                <div key={index} className="flex items-center gap-2 group/prop text-xs">
                    <input
                        value={row.key}
                        onChange={(e) => updateRow(index, { key: e.target.value })}
                        onBlur={() => commitRows(rows)}
                        className="w-28 text-gray-400 bg-transparent outline-none border-b border-transparent focus:border-gray-300 transition-colors"
                    />
                    <span className="text-gray-300">→</span>
                    <input
                        value={row.value}
                        onChange={(e) => updateRow(index, { value: e.target.value })}
                        onBlur={() => commitRows(rows)}
                        placeholder="valeur"
                        className="flex-1 text-gray-600 bg-transparent outline-none border-b border-transparent focus:border-gray-300 transition-colors"
                    />
                    <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="opacity-0 group-hover/prop:opacity-100 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={addRow}
                className="text-xs text-gray-300 hover:text-gray-500 text-left transition-colors cursor-pointer mt-0.5"
            >
                + propriété
            </button>
        </div>
    );
}