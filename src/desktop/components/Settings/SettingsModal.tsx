import { useAtom } from "jotai";
import { useState } from "react";
import {
  IconFolder,
  IconListBullet,
  IconRectangleStack,
  IconTextDocument,
  IconTextformat,
  IconXmark,
} from "../../../shared/components/PlatformIcon";
import { settingsOpenAtom } from "../../../shared/lib/atoms";
import { AuteurTab } from "./tabs/AuteurTab";
import { EditeurTab } from "./tabs/EditeurTab";
import { EspacesTab } from "./tabs/EspacesTab";
import { NavigateurTab } from "./tabs/NavigateurTab";
import { VaultTab } from "./tabs/VaultTab";

type Tab = "editeur" | "navigateur" | "espaces" | "vault" | "auteur";

const TABS: {
  id: Tab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { id: "editeur", label: "Éditeur", Icon: IconTextformat },
  { id: "navigateur", label: "Navigateur", Icon: IconListBullet },
  { id: "espaces", label: "Espaces", Icon: IconRectangleStack },
  { id: "vault", label: "Vault", Icon: IconFolder },
  { id: "auteur", label: "Auteur", Icon: IconTextDocument },
];

export function SettingsModal() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [activeTab, setActiveTab] = useState<Tab>("editeur");

  // useEffect pour Escape géré dans useNodeContextMenu / SettingsModal uniquement
  useState(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20"
      onClick={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-130 h-150 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="relative flex items-center justify-center px-6 pt-5 pb-1 shrink-0">
          <h2 className="text-[13px] font-semibold text-gray-500 tracking-wide uppercase">
            Réglages
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-default"
            aria-label="Fermer"
          >
            <IconXmark className="size-3.5" />
          </button>
        </div>

        {/* Barre de tabs — même style que la TabBar des onglets */}
        <div className="flex gap-1 bg-gray-100 inset-shadow-xs rounded-full p-0.75 mx-6 mt-3 mb-3 shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap transition-all cursor-default ${
                activeTab === id
                  ? "bg-white text-black shadow-sm shadow-gray-400/40 ring-1 ring-white ring-inset inset-shadow-sm inset-shadow-white"
                  : "text-gray-400 hover:bg-gray-200"
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="text-xs font-medium select-none">{label}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-gray-100 shrink-0 mx-1" />

        {/* Contenu scrollable de l'onglet actif */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "editeur" && <EditeurTab />}
          {activeTab === "navigateur" && <NavigateurTab />}
          {activeTab === "espaces" && <EspacesTab />}
          {activeTab === "vault" && <VaultTab />}
          {activeTab === "auteur" && <AuteurTab />}
        </div>
      </div>
    </div>
  );
}
