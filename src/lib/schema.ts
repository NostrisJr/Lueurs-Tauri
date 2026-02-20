// src/lib/schema.ts
export interface PropertyDef {
    type: "text" | "select" | "multiselect" | "date" | "number" | "relation" | "checkbox";
    options?: string[];          // pour select/multiselect
    target?: string;             // pour relation
    required?: boolean;
    defaultValue?: string;
}

export interface TypeDef {
    name: string;
    icon?: string;
    inherits?: string;           // héritage simple
    properties: Record<string, PropertyDef>;
}

export interface VaultSchema {
    types: Record<string, TypeDef>;
}