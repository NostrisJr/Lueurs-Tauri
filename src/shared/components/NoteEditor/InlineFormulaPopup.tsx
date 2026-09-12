/**
 * InlineFormulaPopup.tsx
 *
 * Popup d'édition d'une formule inline du corps de note (singleton, monté une
 * fois dans MarkdownEditor — cf. WikilinkEditPopup). Deux modes, pilotés par
 * `request.mode` (cf. inlineFormulaState.ts) :
 *  - "edit" (défaut) : switcher Nombre/Bouton, puis NumberExprField +
 *    NumberFormatFields (Nombre) ou EnumOptionsFields (Bouton) — cf.
 *    inlineFormulaDraft.ts pour l'état.
 *  - "value" (ENUM uniquement, déclenché par un clic sur le pill dans
 *    node-view.ts) : dropdown rapide de sélection, sans passer par le
 *    switcher — écrit directement le nouveau `default` dans `raw`.
 *
 * À la validation (mode "edit"), écrit la formule brute dans l'attribut du
 * nœud (chemins ref() relatifs au vault, cf. refPaths.ts) ; si la formule est
 * vide, supprime le nœud.
 *
 * Mobile : BottomSheet clavier-aware (mode "edit") ou AnchoredDropdown, qui se
 * rabat lui-même en BottomSheet sur mobile (mode "value"). Desktop : popup/
 * dropdown positionnés près du nœud.
 */

import { editorViewCtx } from "@milkdown/kit/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { toPropertyOptions } from "../../../desktop/components/Frontmatter/lib/frontmatterUtils";
import { BottomSheet } from "../../../mobile/components/BottomSheet/BottomSheet";
import { EnumOptionsDropdown } from "../../components/FrontmatterPicker/EnumOptionsDropdown";
import { PropertyModeFields } from "../../components/FrontmatterPicker/PropertyModeFields";
import type { NoteFile } from "../../hooks/useFileTree";
import {
  parseEnum,
  serializeEnum,
} from "../../lib/FrontmatterPicker/enumProperty";
import type { PropertyType } from "../../lib/FrontmatterPicker/propertyDraft";
import { createLogger } from "../../lib/logger";
import { isMobile } from "../../lib/platform";
import {
  type InlineFormulaMode,
  deriveInlineFormulaDraft,
  serializeInlineFormulaDraft,
  switchInlineFormulaMode,
} from "../../plugins/inline-formula/inlineFormulaDraft";
import {
  getInlineFormulaEdit,
  inlineFormulaBridge,
  setInlineFormulaEdit,
  subscribeInlineFormulaEdit,
} from "../../plugins/inline-formula/inlineFormulaState";
import { toVaultRelative } from "../../plugins/inline-formula/refPaths";
import { activeEditorRef } from "./lib/activeEditorRef";
import { clampPopup } from "./lib/popupPosition";

const POPUP_WIDTH = 360;
const POPUP_EST_HEIGHT = 80;
// Ce popup lui-même est en z-50 (overlay plein écran ci-dessous) : les
// sélecteurs ref()/self[] (AnchoredDropdown, défaut z-15 pensé pour le
// contexte frontmatter) doivent passer AU-DESSUS de ce calque, sinon ils
// s'affichent — et surtout reçoivent les clics — derrière le popup.
const DROPDOWN_Z_INDEX = 60;

const log = createLogger("InlineFormulaPopup");

const MODE_OPTIONS: { value: InlineFormulaMode; label: string }[] = [
  { value: "number", label: "Nombre" },
  { value: "enum", label: "Bouton" },
];

export function InlineFormulaPopup() {
  const request = useSyncExternalStore(
    subscribeInlineFormulaEdit,
    getInlineFormulaEdit,
    () => null
  );

  if (request && request.mode === "value") {
    return <InlineFormulaValuePopup request={request} />;
  }
  return <InlineFormulaEditPopup request={request} />;
}

// ── Mode "value" : dropdown rapide (ENUM uniquement) ─────────────────────

function InlineFormulaValuePopup({
  request,
}: {
  request: NonNullable<ReturnType<typeof getInlineFormulaEdit>>;
}) {
  const def = parseEnum(request.raw);
  const close = useCallback(() => setInlineFormulaEdit(null), []);

  if (!def || !request.anchorEl) return null;

  return (
    <EnumOptionsDropdown
      anchorRef={{ current: request.anchorEl }}
      value={def.default}
      constraint={def}
      zIndex={DROPDOWN_Z_INDEX}
      onClose={close}
      onSelect={(v) => {
        const editor = activeEditorRef.current;
        editor?.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const node = view.state.doc.nodeAt(request.pos);
          if (!node || node.type.name !== "inline_formula") return;
          view.dispatch(
            view.state.tr.setNodeAttribute(
              request.pos,
              "raw",
              serializeEnum({ ...def, default: v })
            )
          );
          view.focus();
          log.info("formule inline ENUM : valeur changée (dropdown rapide)", {
            pos: request.pos,
            value: v,
          });
        });
        close();
      }}
    />
  );
}

// ── Mode "edit" : switcher Nombre/Bouton + popup complet ───────────────────

function InlineFormulaEditPopup({
  request,
}: {
  request: ReturnType<typeof getInlineFormulaEdit>;
}) {
  const [draft, setDraft] = useState(() =>
    deriveInlineFormulaDraft(request?.raw ?? "$$$$")
  );
  const draftRef = useRef(draft);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const updateDraft = useCallback((next: typeof draft) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  // (Ré)initialise à l'ouverture.
  useEffect(() => {
    if (!request) return;
    updateDraft(deriveInlineFormulaDraft(request.raw));
  }, [request, updateDraft]);

  useLayoutEffect(() => {
    if (!request || isMobile) {
      setPos(null);
      return;
    }
    setPos(clampPopup(request.coords, POPUP_WIDTH, POPUP_EST_HEIGHT));
  }, [request]);

  const close = useCallback(() => setInlineFormulaEdit(null), []);

  const commit = useCallback(() => {
    const req = getInlineFormulaEdit();
    const editor = activeEditorRef.current;
    if (!req || !editor) {
      close();
      return;
    }
    const value = serializeInlineFormulaDraft(draftRef.current);
    const isEmpty = value === "$$$$";
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(req.pos);
      if (!node || node.type.name !== "inline_formula") return;
      const tr = isEmpty
        ? view.state.tr.delete(req.pos, req.pos + node.nodeSize)
        : view.state.tr.setNodeAttribute(req.pos, "raw", value);
      view.dispatch(tr);
      view.focus();
      log.info(
        isEmpty ? "formule inline supprimée (vide)" : "formule inline éditée",
        {
          pos: req.pos,
        }
      );
    });
    close();
  }, [close]);

  // Commit en live (sans fermer, et sans jamais supprimer le nœud même si le
  // brouillon est momentanément vide en cours de frappe — seule la fermeture
  // explicite via commit() traite un brouillon vide comme une suppression) :
  // même filet de sécurité que useValueEditor côté frontmatter panel (cf.
  // commit 876a3b3) — sans lui, démonter ce popup sans passer par
  // Entrée/Échap/clic extérieur (ex: navigation vers une autre note) perdait
  // le brouillon en cours sans jamais l'écrire dans le document. Comparé à
  // node.attrs.raw (l'état réel du document), pas à request.raw (figé à
  // l'ouverture, jamais mis à jour par ces écritures live) — sinon chaque
  // frappe redéclencherait un dispatch même à valeur inchangée.
  useEffect(() => {
    const req = getInlineFormulaEdit();
    const editor = activeEditorRef.current;
    if (!req || !editor) return;
    const value = serializeInlineFormulaDraft(draft);
    if (value === "$$$$") return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(req.pos);
      if (!node || node.type.name !== "inline_formula") return;
      if (node.attrs.raw === value) return;
      view.dispatch(view.state.tr.setNodeAttribute(req.pos, "raw", value));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à une vraie modification du brouillon, pas à chaque render
  }, [draft]);

  // Contexte d'évaluation (hors React) : figé le temps d'une ouverture du popup.
  const ctx = inlineFormulaBridge.current;
  const vaultPath = ctx?.vaultPath;
  // Chemins ref() relatifs au vault dans le corps (cf. refPaths.ts).
  const refPathOf = useCallback(
    (note: NoteFile) =>
      vaultPath ? toVaultRelative(note.id, vaultPath) : note.id,
    [vaultPath]
  );
  // Auto-complétion `self.` : propriétés de la note courante.
  const selfProperties = useMemo(
    () => toPropertyOptions(Object.keys(ctx?.vars ?? {})),
    [ctx?.vars]
  );

  if (!request) return null;

  const body = (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        // Filet pour les champs sans gestion clavier propre (littéral Nombre,
        // décimales/unité, options Bouton) — même principe que le container
        // du panneau frontmatter (cf. useExpandPanel.containerProps).
        // FormulaEditField gère déjà Entrée/Échap lui-même : double appel
        // inoffensif (close() est idempotent une fois request devenu null).
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          commit();
        }
      }}
    >
      <PropertyModeFields
        modeOptions={MODE_OPTIONS}
        mode={draft.mode}
        onModeChange={(mode: PropertyType) => {
          // "text" n'apparaît jamais dans MODE_OPTIONS — un nœud de formule
          // inline n'est jamais "juste du texte" (cf. PropertyModeFields).
          if (mode === "text") return;
          updateDraft(switchInlineFormulaMode(draft, mode));
        }}
        numberDef={draft.numberDef}
        onNumberDefChange={(numberDef) => updateDraft({ ...draft, numberDef })}
        enumDef={draft.enumDef}
        onEnumDefChange={(enumDef) => updateDraft({ ...draft, enumDef })}
        allNotes={ctx?.allNotes ?? []}
        noteResolver={ctx?.noteResolver ?? (() => undefined)}
        selfProperties={selfProperties}
        refPathOf={refPathOf}
        dropdownZIndex={DROPDOWN_Z_INDEX}
        autoFocus
      />
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet onClose={commit} title="Formule" heightFraction={0.4}>
        <div className="px-4 pt-1 pb-4">{body}</div>
      </BottomSheet>
    );
  }

  if (!pos) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onMouseDown={(e) => {
        // NoteSelector/PropertySelector (déclenchés par ref(/self[) sont des
        // AnchoredDropdown : leur portail atterrit sous <body>, en dehors du
        // sous-arbre de ce popup — un clic dedans remonte donc jusqu'ici (React
        // fait bubbler à travers l'arbre React, pas le DOM réel) et déclenchait
        // un commit prématuré de la formule encore incomplète (→ #ERREUR) avant
        // même que le choix ne s'applique.
        if ((e.target as Element).closest("[data-anchored-dropdown]")) return;
        commit();
      }}
    >
      <div
        className="absolute rounded-lg border border-gray-200 bg-white p-2 shadow-xl"
        style={{ left: pos.left, top: pos.top, width: POPUP_WIDTH }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>,
    document.body
  );
}
