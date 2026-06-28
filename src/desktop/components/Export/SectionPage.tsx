import { useState } from "react";
import { PillGroup, Section, Slider, Toggle } from "./ExportControls";
import { useExportOptions } from "./useExportOptions";

function labelNiveauNouvellePage(v: number): string {
  if (v === 0) return "Aucun";
  if (v === 1) return "H1";
  return `H1 – H${v}`;
}

export function SectionPage() {
  const { options, setOption } = useExportOptions();
  const [open, setOpen] = useState(true);

  return (
    <Section title="Page" open={open} onToggle={() => setOpen((v) => !v)}>
      <PillGroup
        label="Format"
        options={["A4", "A5", "Letter", "Legal"] as const}
        value={options.format}
        onChange={(v) => setOption("format", v)}
      />
      <PillGroup
        label="Marges"
        options={["etroites", "normales", "larges"] as const}
        labels={["Étroites", "Normales", "Larges"]}
        value={options.marges}
        onChange={(v) => setOption("marges", v)}
      />
      <Toggle
        label="Page de titre"
        value={options.pageDeTitre}
        onChange={(v) => setOption("pageDeTitre", v)}
      />
      {options.pageDeTitre && (
        <Toggle
          label="Bloc auteur"
          value={options.blocAuteur}
          onChange={(v) => setOption("blocAuteur", v)}
          indent
        />
      )}
      <Toggle
        label="Numéros de page"
        value={options.numerosPage}
        onChange={(v) => setOption("numerosPage", v)}
      />
      {options.numerosPage && options.sommaire && (
        <Toggle
          label="Commencer après le sommaire"
          value={options.numerotationApresSommaire}
          onChange={(v) => setOption("numerotationApresSommaire", v)}
          indent
        />
      )}
      <Slider
        label="Nouvelle page à partir de"
        min={0}
        max={6}
        value={options.niveauNouvellePage}
        valueLabel={labelNiveauNouvellePage(options.niveauNouvellePage)}
        onChange={(v) => setOption("niveauNouvellePage", v)}
      />
    </Section>
  );
}
