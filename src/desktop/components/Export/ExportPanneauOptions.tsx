import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  activeNoteFolderAtom,
  allFoldersAtom,
  exportDialogOpenAtom,
  exportFolderIdAtom,
  exportModeAtom,
} from "../../../shared/lib/atoms";
import { PillGroup } from "./ExportControls";
import { SectionCompilation } from "./SectionCompilation";
import { SectionPage } from "./SectionPage";
import { SectionParagraphes } from "./SectionParagraphes";
import { SectionTitresSommaire } from "./SectionTitresSommaire";

export function ExportPanneauOptions({
  compilerApercu,
  exporterPDF,
  exporterTypst,
  recompilation,
}: {
  compilerApercu: () => void;
  exporterPDF: () => Promise<void>;
  exporterTypst: () => Promise<void>;
  recompilation: boolean;
}) {
  const [exportMode, setExportMode] = useAtom(exportModeAtom);
  const [exportFolderId, setExportFolderId] = useAtom(exportFolderIdAtom);
  const activeNoteFolder = useAtomValue(activeNoteFolderAtom);
  const allFolders = useAtomValue(allFoldersAtom);
  const setOpen = useSetAtom(exportDialogOpenAtom);

  return (
    <div className="w-72 shrink-0 border-r border-gray-100 p-5 flex flex-col gap-3 overflow-y-auto">
      <h2 className="text-sm font-semibold text-gray-900">Exporter</h2>

      <PillGroup
        label="Mode"
        options={["note", "dossier"] as const}
        labels={["Note", "Dossier"]}
        value={exportMode}
        onChange={(v) => {
          setExportMode(v);
          if (v === "dossier") setExportFolderId(null);
        }}
      />

      {exportMode === "dossier" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Dossier racine</span>
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-900"
            value={exportFolderId ?? activeNoteFolder?.id ?? ""}
            onChange={(e) => setExportFolderId(e.target.value || null)}
          >
            {allFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {exportMode === "dossier" && <SectionCompilation />}
      <SectionPage />
      <SectionParagraphes />
      <SectionTitresSommaire />

      <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={compilerApercu}
          disabled={recompilation}
          className="py-1.5 px-3 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {recompilation ? "Compilation…" : "Recompiler"}
        </button>
        <button
          type="button"
          onClick={exporterPDF}
          disabled={recompilation}
          className="py-1.5 px-3 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          Exporter PDF
        </button>
        <button
          type="button"
          onClick={exporterTypst}
          className="py-1.5 px-3 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer"
        >
          Exporter source .typ
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="py-1.5 px-3 rounded-lg text-gray-500 text-xs hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
