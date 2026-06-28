import { useState } from "react";
import { Section, Toggle } from "./ExportControls";
import { useExportOptions } from "./useExportOptions";

export function SectionTitresSommaire() {
  const { options, setOption } = useExportOptions();
  const [open, setOpen] = useState(false);

  return (
    <Section
      title="Titres & Sommaire"
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <Toggle
        label="Sommaire"
        value={options.sommaire}
        onChange={(v) => setOption("sommaire", v)}
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500">Numérotation des titres</span>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-900"
          value={options.numerotationTitres}
          onChange={(e) =>
            setOption(
              "numerotationTitres",
              e.target.value as typeof options.numerotationTitres
            )
          }
        >
          <option value="none">Aucune</option>
          <option value="1.">1. 2. 3.</option>
          <option value="1.1.">1.1. 1.2. 1.3.</option>
          <option value="I.">I. II. III.</option>
          <option value="i.">i. ii. iii.</option>
          <option value="A.">A. B. C.</option>
          <option value="a.">a. b. c.</option>
        </select>
      </div>
    </Section>
  );
}
