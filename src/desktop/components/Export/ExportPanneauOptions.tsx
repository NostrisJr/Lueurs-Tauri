import clsx from "clsx";
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
    <div
      className={clsx(
        "w-72 shrink-0 border-r p-5 flex flex-col gap-3 overflow-y-auto",
        "border-line"
      )}
    >
      <h2 className="text-sm font-semibold text-ink">Exporter</h2>

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
          <span className="text-xs text-ink-3">Dossier racine</span>
          <select
            className={clsx(
              "text-xs border rounded-lg px-2 py-1.5",
              "border-line-2 bg-surface text-ink"
            )}
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

      <div
        className={clsx(
          "mt-auto flex flex-col gap-2 pt-2 border-t",
          "border-line"
        )}
      >
        <button
          type="button"
          onClick={compilerApercu}
          disabled={recompilation}
          className={clsx(
            "py-1.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50",
            "bg-inverse text-on-inverse",
            "hover:bg-inverse-2"
          )}
        >
          {recompilation ? "Compilation…" : "Recompiler"}
        </button>
        <button
          type="button"
          onClick={exporterPDF}
          disabled={recompilation}
          className={clsx(
            "py-1.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50",
            "bg-info text-on-inverse",
            "hover:bg-link"
          )}
        >
          Exporter PDF
        </button>
        <button
          type="button"
          onClick={exporterTypst}
          className={clsx(
            "py-1.5 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer",
            "bg-surface-3 text-ink-2",
            "hover:bg-surface-4"
          )}
        >
          Exporter source .typ
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={clsx(
            "py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer",
            "text-ink-3",
            "hover:bg-surface-2"
          )}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
