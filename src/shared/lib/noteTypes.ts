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

export type NoteTypeValue = (typeof NoteType)[keyof typeof NoteType];

// ── Propriétés système ─────────────────────────────────────────────────────

export const SystemField = {
  TYPE: "__Type__",
  BASE: "__Base__",
  CHILDREN: "__Children__",
  TEMPLATE: "__Template__",
  VIEW: "__View__",
  KANBAN_KEY: "__KanbanKey__",
  KANBAN_COLUMNS: "__KanbanColumns__",
  TABLE_COLUMNS: "__TableColumns__",
  TABLE_AGGREGATIONS: "__TableAggregations__",
  DEFAULT_FOLDER: "__DefaultFolder__",
  DISPLAY_MODE: "__DisplayMode__",
  SPACE: "__space__",
  READ_ONLY: "__ReadOnly__",
} as const;

export type SystemFieldKey = (typeof SystemField)[keyof typeof SystemField];

// ── Vues disponibles ───────────────────────────────────────────────────────

export const BaseViewEnum = {
  DEFAULT: "default",
  KANBAN: "kanban",
  TABLE: "table",
} as const;

export type BaseViewType = (typeof BaseViewEnum)[keyof typeof BaseViewEnum];

// ── Structure d'une colonne Kanban ─────────────────────────────────────────

// Persistée en YAML dans __KanbanColumns__ de la base.
// id : clé stable (jamais modifiée), label : valeur écrite dans les notes enfants.
// color : id couleur highlight, uniquement pour les clés BUTTON (colonnes dérivées
// des options du template, voir resolveButtonKey).
export interface KanbanColumn {
  id: string;
  label: string;
  color?: string;
}

// ── Définition des propriétés système ─────────────────────────────────────

export interface SystemFieldDef {
  key: SystemFieldKey;
  label: string;
  description: string;
  kind: "string" | "noteArray";
  noteFilter: NoteTypeValue[] | null;
  compatibleTypes: NoteTypeValue[];
  required: boolean;
  readOnly: boolean;
  hidden: boolean;
}

export const SYSTEM_FIELDS: SystemFieldDef[] = [
  {
    key: SystemField.TYPE,
    label: "Type",
    description: "Type de la note. Géré automatiquement par Lueurs.",
    kind: "string",
    noteFilter: null,
    compatibleTypes: [
      NoteType.NOTE,
      NoteType.FOLDER,
      NoteType.TEMPLATE,
      NoteType.BASE,
    ],
    required: true,
    readOnly: true,
    hidden: false,
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
    hidden: false,
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
    hidden: false,
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
    hidden: false,
  },
  {
    key: SystemField.DEFAULT_FOLDER,
    label: "Dossier par défaut",
    description:
      "Dossier dans lequel les nouvelles notes de cette base sont créées.",
    kind: "string",
    noteFilter: null,
    compatibleTypes: [NoteType.BASE],
    required: false,
    readOnly: false,
    hidden: false,
  },
  {
    key: SystemField.SPACE,
    label: "Espace",
    description: "Espaces auxquels cette note appartient.",
    kind: "noteArray",
    noteFilter: null,
    compatibleTypes: [NoteType.NOTE, NoteType.FOLDER],
    required: false,
    readOnly: false,
    hidden: false,
  },
  {
    key: SystemField.READ_ONLY,
    label: "Lecture seule",
    description:
      "Empêche l'édition du contenu, des autres propriétés et le renommage de la note.",
    // Rendu spécial par clé dans FrontmatterValue (case à cocher), comme __Type__.
    kind: "string",
    noteFilter: null,
    compatibleTypes: [
      NoteType.NOTE,
      NoteType.FOLDER,
      NoteType.TEMPLATE,
      NoteType.BASE,
    ],
    required: false,
    readOnly: false,
    hidden: false,
  },
  // __View__, __KanbanKey__, __KanbanColumns__ sont gérés exclusivement
  // via le sélecteur de vue — non ajoutables manuellement via l'UI.
];

// ── Helpers ────────────────────────────────────────────────────────────────

export function getAddableFields(
  noteType: NoteTypeValue | null,
  existingKeys: string[]
): SystemFieldDef[] {
  return SYSTEM_FIELDS.filter((field) => {
    if (field.required) return false;
    if (existingKeys.includes(field.key)) return false;
    if (!noteType) return true;
    return field.compatibleTypes.includes(noteType);
  });
}

export function getFieldDef(key: string): SystemFieldDef | null {
  return SYSTEM_FIELDS.find((f) => f.key === key) ?? null;
}

// Note verrouillée en lecture seule (__ReadOnly__: true dans le frontmatter)
export function isNoteReadOnly(
  frontmatter: Record<string, unknown> | undefined
): boolean {
  return frontmatter?.[SystemField.READ_ONLY] === "true";
}

// Retourne true si la clé est un champ système fonctionnel (non éditable manuellement)
export function isFunctionalBaseField(key: string): boolean {
  return (
    key === SystemField.VIEW ||
    key === SystemField.KANBAN_KEY ||
    key === SystemField.KANBAN_COLUMNS ||
    key === SystemField.TABLE_COLUMNS ||
    key === SystemField.TABLE_AGGREGATIONS ||
    key === SystemField.DISPLAY_MODE
  );
}
