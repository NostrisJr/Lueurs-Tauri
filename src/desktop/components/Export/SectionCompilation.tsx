import { useState } from "react";
import { PillGroup, Section, Toggle } from "./ExportControls";
import { useExportOptions } from "./useExportOptions";

export function SectionCompilation() {
  const { multiOpts, setMultiOpt } = useExportOptions();
  const [open, setOpen] = useState(true);

  return (
    <Section
      title="Compilation"
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <PillGroup
        label="Notes de dossier"
        options={["preface", "ignorer"] as const}
        labels={["Préface", "Ignorer"]}
        value={multiOpts.notesDossier}
        onChange={(v) => setMultiOpt("notesDossier", v)}
      />
      {multiOpts.notesDossier === "preface" && (
        <Toggle
          label="Centrer la préface sur la page"
          value={multiOpts.prefaceCentree}
          onChange={(v) => setMultiOpt("prefaceCentree", v)}
          indent
        />
      )}
      <PillGroup
        label="Titre de section"
        options={["nom", "contenu"] as const}
        labels={["Nom du fichier", "Premier titre"]}
        value={multiOpts.titrageNotes}
        onChange={(v) => setMultiOpt("titrageNotes", v)}
      />
      {multiOpts.titrageNotes === "nom" && (
        <Toggle
          label="Page de titre par note"
          value={multiOpts.pageTitreParNote}
          onChange={(v) => setMultiOpt("pageTitreParNote", v)}
        />
      )}
      {(!multiOpts.pageTitreParNote ||
        multiOpts.titrageNotes === "contenu") && (
        <Toggle
          label="Nouvelle page par note"
          value={multiOpts.nouvellePagesParNote}
          onChange={(v) => setMultiOpt("nouvellePagesParNote", v)}
          indent={multiOpts.titrageNotes === "nom"}
        />
      )}
    </Section>
  );
}
