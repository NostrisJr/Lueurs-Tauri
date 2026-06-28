import { useState } from "react";
import { PillGroup, Section, Toggle } from "./ExportControls";
import { useExportOptions } from "./useExportOptions";

export function SectionParagraphes() {
  const { options, setOption } = useExportOptions();
  const [open, setOpen] = useState(true);

  return (
    <Section
      title="Paragraphes"
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <PillGroup
        label="Police"
        options={["inter", "garamond"] as const}
        labels={["Inter", "Garamond"]}
        value={options.police}
        onChange={(v) => setOption("police", v)}
      />
      <PillGroup
        label="Taille du texte"
        options={["small", "normal", "large"] as const}
        labels={["Petite", "Normale", "Grande"]}
        value={options.taille}
        onChange={(v) => setOption("taille", v)}
      />
      <PillGroup
        label="Interligne"
        options={["compact", "normale", "aeree"] as const}
        labels={["Compact", "Normale", "Aérée"]}
        value={options.interligne}
        onChange={(v) => setOption("interligne", v)}
      />
      <Toggle
        label="Texte justifié"
        value={options.justification}
        onChange={(v) => setOption("justification", v)}
      />
      <Toggle
        label="Barres colorées (citations, poésie)"
        value={options.barresLaterales}
        onChange={(v) => setOption("barresLaterales", v)}
      />
      <Toggle
        label="Indentation des paragraphes"
        value={options.indentation}
        onChange={(v) => setOption("indentation", v)}
      />
      {options.indentation && (
        <Toggle
          label="Indenter aussi le 1er paragraphe"
          value={options.indenterPremierParagraphe}
          onChange={(v) => setOption("indenterPremierParagraphe", v)}
          indent
        />
      )}
    </Section>
  );
}
