import { useAtom } from "jotai";
import { useEffect } from "react";
import { exportDialogOpenAtom } from "../../../shared/lib/atoms";
import { ExportApercuPages } from "./ExportApercuPages";
import { ExportPanneauOptions } from "./ExportPanneauOptions";
import { useExport } from "./useExport";

export function ExportDialog() {
  const [open, setOpen] = useAtom(exportDialogOpenAtom);
  const {
    pages,
    recompilation,
    erreur,
    compilerApercu,
    exporterPDF,
    exporterTypst,
  } = useExport(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20"
      onClick={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clic extérieur ferme la modale */}
      <div
        className="bg-white rounded-xl shadow-xl flex overflow-hidden"
        style={{ width: 900, height: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <ExportPanneauOptions
          compilerApercu={compilerApercu}
          exporterPDF={exporterPDF}
          exporterTypst={exporterTypst}
          recompilation={recompilation}
        />
        <ExportApercuPages
          pages={pages}
          recompilation={recompilation}
          erreur={erreur}
        />
      </div>
    </div>
  );
}
