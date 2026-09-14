import clsx from "clsx";
import { useState } from "react";
import { EnumValueSelector } from "../../../../shared/components/FrontmatterPicker/EnumValueSelector";
import { NumberCellSelector } from "../../../../shared/components/FrontmatterPicker/NumberCellSelector";
import { PropertyCellSettingsPopup } from "../../../../shared/components/FrontmatterPicker/PropertyCellSettingsPopup";
import { usePropertyCellSettings } from "../../../../shared/components/FrontmatterPicker/usePropertyCellSettings";
import type { NoteFile } from "../../../../shared/hooks/useFileTree";
import {
  type EnumDef,
  parseEnum,
  serializeEnum,
} from "../../../../shared/lib/FrontmatterPicker/enumProperty";
import {
  type NumberDef,
  isNumberFormula,
} from "../../../../shared/lib/FrontmatterPicker/numberProperty";
import { computeFormula, isFormula } from "../../../../shared/lib/formulas";
import { useLongPress, useLongPressCapture } from "../../../hooks/useLongPress";
import { hapticImpact } from "../../../lib/haptics";
import { CELL_WIDTH } from "./constants";

interface Props {
  fieldKey: string;
  value: string;
  isImposed: boolean;
  enumConstraint?: EnumDef;
  numberFormatConstraint?: NumberDef;
  frontmatter: Record<string, unknown>;
  noteResolver: (path: string) => NoteFile | undefined;
  allNotes: NoteFile[];
  onCommit: (value: string) => void;
}

export function MobileTableCell({
  fieldKey,
  value,
  isImposed,
  enumConstraint,
  numberFormatConstraint,
  frontmatter,
  noteResolver,
  allNotes,
  onCommit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const formula = isFormula(value);
  // Réglages Texte/Nombre/Bouton — instancié UNE fois pour toute la cellule
  // (partagé par NumberCellSelector et PropertyCellSettingsPopup ci-dessous).
  // Déclenché par appui long sur la cellule (cf. useLongPress/useLongPressCapture
  // plus bas) plutôt que par la roue crantée, invisible au tactile (hover-only) —
  // PropertyCellSettingsPopup ne monte d'ailleurs plus son bouton roue sur mobile.
  const cellSettings = usePropertyCellSettings(
    value,
    onCommit,
    numberFormatConstraint
  );

  const displayValue = formula
    ? computeFormula(value, frontmatter, undefined, noteResolver)
    : value;

  function commit() {
    setEditing(false);
    onCommit(draft);
  }

  function openSettings() {
    if (isImposed) return;
    hapticImpact("medium");
    cellSettings.openPopup();
  }

  // Enum/Nombre enveloppent un enfant déjà cliquable (EnumValueSelector,
  // NumberCellSelector) : le clic fantôme d'un appui long doit être intercepté
  // en phase de capture, avant qu'il n'atteigne cet enfant (cf.
  // useLongPressCapture).
  const settingsLongPressCapture = useLongPressCapture(openSettings);
  // Branche générique (texte/formule) : la cellule elle-même porte le clic
  // court (édition inline), pas d'enfant à protéger — variante bubble standard.
  const cellLongPress = useLongPress(openSettings, () => {
    if (!isImposed && !formula) {
      setDraft(value);
      setEditing(true);
    }
  });

  // ── Contrainte ENUM : dropdown ──────────────────────────────────────────
  if (enumConstraint) {
    return (
      <div
        className={clsx(
          "shrink-0 px-3 py-2 border-r last:border-none flex items-center",
          "border-line"
        )}
        style={{ width: CELL_WIDTH }}
      >
        <EnumValueSelector
          value={value}
          constraint={enumConstraint}
          onChange={onCommit}
        />
      </div>
    );
  }

  // ── Colonne NUMBER : popup expr + décimales/unité (cf. TableCell desktop) ─
  if (!isImposed && (numberFormatConstraint || isNumberFormula(value))) {
    return (
      <div
        className={clsx(
          "shrink-0 px-3 py-2 border-r last:border-none flex items-center",
          "border-line"
        )}
        style={{ width: CELL_WIDTH }}
        {...settingsLongPressCapture}
      >
        <NumberCellSelector
          fieldKey={fieldKey}
          value={value}
          numberFormatConstraint={numberFormatConstraint}
          frontmatter={frontmatter}
          noteResolver={noteResolver}
          allNotes={allNotes}
          settings={cellSettings}
        />
      </div>
    );
  }

  // ── Propriété ENUM non contrainte (définie directement sur la note, sans
  // template) : même pill + dropdown, plutôt que le texte brut de la formule.
  const committedEnumDef = !isImposed ? parseEnum(value) : null;
  if (committedEnumDef) {
    // Réglages ouverts en Bouton : le pill lit/écrit le brouillon en cours
    // plutôt que de committer directement — sinon un tap sur le pill pendant
    // que le popup de réglages est ouvert écrirait la nouvelle valeur, puis la
    // fermeture du popup écraserait ce choix avec son brouillon désormais
    // périmé (même risque que celui corrigé plus haut, via un autre chemin).
    const openEnumDraft =
      cellSettings.open && cellSettings.draft?.type === "enum"
        ? cellSettings.draft
        : null;
    const activeEnumDef = openEnumDraft?.enumDef ?? committedEnumDef;
    return (
      <div
        className={clsx(
          "shrink-0 px-3 py-2 border-r last:border-none flex items-center relative group",
          "border-line"
        )}
        style={{ width: CELL_WIDTH }}
        {...settingsLongPressCapture}
      >
        <EnumValueSelector
          value={activeEnumDef.default}
          constraint={activeEnumDef}
          onChange={(v) => {
            if (openEnumDraft) {
              cellSettings.setDraft({
                ...openEnumDraft,
                enumDef: { ...activeEnumDef, default: v },
              });
            } else {
              onCommit(serializeEnum({ ...committedEnumDef, default: v }));
            }
          }}
        />
        <PropertyCellSettingsPopup
          settings={cellSettings}
          fieldKey={fieldKey}
          frontmatter={frontmatter}
          noteResolver={noteResolver}
          allNotes={allNotes}
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "shrink-0 px-3 py-2 border-r border-line last:border-none relative",
        !isImposed ? "group" : ""
      )}
      style={{ width: CELL_WIDTH }}
      {...cellLongPress}
    >
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: focus intentionnel
          autoFocus
          value={draft}
          onChange={(e) => {
            const newVal = e.target.value;
            // Auto-pair : $$ → ouvre les réglages Texte/Nombre/Bouton (roue
            // crantée) plutôt que de basculer en édition de formule brute —
            // même mécanique que TableCell desktop.
            if (newVal.endsWith("$$") && !draft.endsWith("$$")) {
              setEditing(false);
              cellSettings.openAsFormula();
              return;
            }
            setDraft(newVal);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          style={{ fontSize: 16 }}
          className={clsx(
            "w-full bg-transparent outline-none text-sm",
            "text-ink-2"
          )}
        />
      ) : (
        <span
          className={clsx(
            "text-sm truncate block",
            formula
              ? "text-ink-4"
              : isImposed
                ? "text-ink-5"
                : value
                  ? "text-ink-2"
                  : "text-ink-5"
          )}
        >
          {formula ? (
            <span className="flex items-center gap-1">
              <span className="text-ink-5 font-mono text-[10px]">ƒ</span>
              {displayValue || "—"}
            </span>
          ) : (
            displayValue || "—"
          )}
        </span>
      )}
      {!isImposed && !editing && (
        <PropertyCellSettingsPopup
          settings={cellSettings}
          fieldKey={fieldKey}
          frontmatter={frontmatter}
          noteResolver={noteResolver}
          allNotes={allNotes}
        />
      )}
    </div>
  );
}
