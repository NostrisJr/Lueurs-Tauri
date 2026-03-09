// ── Types de notes ─────────────────────────────────────────────────────────
//
// Source de vérité pour les types natifs et les propriétés système de Lueurs.
// Toute la logique de compatibilité et d'affichage est centralisée ici.

export const NoteType = {
    NOTE: "__note__",
    FOLDER: "__folder__",
    TEMPLATE: "__template__",
    BASE: "__base__",
} as const;

export type NoteTypeValue = typeof NoteType[keyof typeof NoteType];

// ── Propriétés système ─────────────────────────────────────────────────────

export const SystemField = {
    TYPE: "__Type__",
    BASE: "__Base__",
    CHILDREN: "__Children__",
    TEMPLATE: "__Template__",
} as const;

export type SystemFieldKey = typeof SystemField[keyof typeof SystemField];

// ── Définition des propriétés système ─────────────────────────────────────

export interface SystemFieldDef {
    key: SystemFieldKey;
    label: string;               // Nom affiché dans l'UI (sans les __)
    description: string;         // Courte description pour le tooltip/dropdown
    kind: "string" | "noteArray" // "noteArray" = array de chemins de notes
    noteFilter: NoteTypeValue[] | null; // null = toutes les notes
    compatibleTypes: NoteTypeValue[];   // Types de notes sur lesquels ce champ a du sens
    required: boolean;           // Ajouté automatiquement si absent
    readOnly: boolean;           // Non supprimable ni renommable dans l'UI
}

export const SYSTEM_FIELDS: SystemFieldDef[] = [
    {
        key: SystemField.TYPE,
        label: "Type",
        description: "Type de la note. Géré automatiquement par Lueurs.",
        kind: "string",
        noteFilter: null,
        compatibleTypes: [NoteType.NOTE, NoteType.FOLDER, NoteType.TEMPLATE, NoteType.BASE],
        required: true,
        readOnly: true,
    },
    {
        key: SystemField.BASE,
        label: "Base",
        description: "Bases auxquelles cette note appartient.",
        kind: "noteArray",
        noteFilter: [NoteType.BASE],
        compatibleTypes: [NoteType.NOTE, NoteType.FOLDER],
        required: false,
        readOnly: false,
    },
    {
        key: SystemField.CHILDREN,
        label: "Children",
        description: "Notes enfant de cette base. Géré automatiquement.",
        kind: "noteArray",
        noteFilter: null,
        compatibleTypes: [NoteType.BASE],
        required: false,
        readOnly: false,
    },
    {
        key: SystemField.TEMPLATE,
        label: "Template",
        description: "Templates contraignant les propriétés de cette note.",
        kind: "noteArray",
        noteFilter: [NoteType.TEMPLATE],
        compatibleTypes: [NoteType.NOTE, NoteType.FOLDER, NoteType.BASE],
        required: false,
        readOnly: false,
    },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Retourne les propriétés système compatibles avec un type de note donné,
 *  en excluant celles déjà présentes dans le frontmatter. */
export function getAddableFields(
    noteType: NoteTypeValue | null,
    existingKeys: string[]
): SystemFieldDef[] {
    return SYSTEM_FIELDS.filter((field) => {
        if (field.required) return false;                          // Déjà géré automatiquement
        if (existingKeys.includes(field.key)) return false;        // Déjà présent
        if (!noteType) return true;                                // Type inconnu → tout proposer
        return field.compatibleTypes.includes(noteType);
    });
}

/** Retourne la définition d'un champ système par sa clé, ou null. */
export function getFieldDef(key: string): SystemFieldDef | null {
    return SYSTEM_FIELDS.find((f) => f.key === key) ?? null;
}