import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { settingsOpenAtom, folderPathAtom } from "../../lib/atoms";
import { useFileTree } from "../FileTree/hooks/useFileTree";

export function SettingsModal() {
    const [open, setOpen] = useAtom(settingsOpenAtom);
    const folderPath = useAtomValue(folderPathAtom);
    const { pickFolder } = useFileTree();

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Paramètres</h2>
                </div>

                <div className="px-6 py-5 space-y-6">
                    <section>
                        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                            Vault
                        </h3>
                        <div className="space-y-1.5">
                            <p className="text-xs text-gray-500">Dossier racine</p>
                            <div className="flex items-center gap-2">
                                <span className="flex-1 min-w-0 text-sm text-gray-700 font-mono bg-gray-50 rounded-md px-3 py-2 truncate">
                                    {folderPath ?? "–"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => { pickFolder(); setOpen(false); }}
                                    className="px-3 py-2 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors cursor-pointer shrink-0"
                                >
                                    Changer
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
