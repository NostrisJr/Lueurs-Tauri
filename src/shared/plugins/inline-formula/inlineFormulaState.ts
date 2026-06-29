/**
 * inlineFormulaState.ts
 *
 * Deux stores module-level pour les formules inline du corps de note :
 *  - `inlineFormulaBridge` : contexte d'évaluation (lu hors React par la NodeView
 *    et le popup) — self.*, résolution ref(), enfants pour agg(). Alimenté par
 *    MarkdownEditor, comme `wikilinkBridge`.
 *  - état d'édition (`get/set/subscribe`) : pilote le popup d'édition, comme
 *    `wikilinkEditState`.
 *  - registre des NodeViews : permet de recalculer tous les résultats affichés
 *    quand l'arbre de notes change (sans transaction sur le doc).
 */

import type { NoteFile } from "../../hooks/useFileTree";

export interface InlineFormulaContext {
  /** self.prop → frontmatter de la note courante. */
  vars: Record<string, unknown>;
  /** Enfants de la note courante — pour agg() (rare en inline). */
  children?: NoteFile[];
  /** Résolution d'une note par chemin absolu — pour ref(). */
  noteResolver: (path: string) => NoteFile | undefined;
  /** Toutes les notes — pour les sélecteurs du popup. */
  allNotes: NoteFile[];
}

export const inlineFormulaBridge: { current: InlineFormulaContext | null } = {
  current: null,
};

// ── État d'édition (popup) ────────────────────────────────────────────────

export interface InlineFormulaEditRequest {
  /** Position du nœud dans le document. */
  pos: number;
  /** Formule brute actuelle (`$$…$$`, chemins absolus). */
  raw: string;
  /** Ancre écran (coin haut-gauche du nœud). */
  coords: { left: number; top: number; bottom: number };
}

let current: InlineFormulaEditRequest | null = null;
const listeners = new Set<() => void>();

export function setInlineFormulaEdit(next: InlineFormulaEditRequest | null) {
  current = next;
  for (const l of listeners) l();
}

export function getInlineFormulaEdit() {
  return current;
}

export function subscribeInlineFormulaEdit(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Registre des NodeViews (recalcul au changement d'arbre) ────────────────

const views = new Set<() => void>();

export function registerInlineFormulaView(rerender: () => void) {
  views.add(rerender);
  return () => {
    views.delete(rerender);
  };
}

/** Force le recalcul du résultat affiché par toutes les formules inline. */
export function refreshInlineFormulas() {
  for (const r of views) r();
}

/** Extrait l'expression intérieure d'une formule brute `$$expr$$`. */
export function formulaInner(raw: string): string {
  return raw.replace(/^\$\$/, "").replace(/\$\$$/, "");
}
