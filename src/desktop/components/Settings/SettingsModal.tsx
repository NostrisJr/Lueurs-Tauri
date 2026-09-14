import clsx from "clsx";
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
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { settingsOpenAtom } from "../../../shared/lib/atoms";
import { AuteurTab } from "./tabs/AuteurTab";
import { EditeurTab } from "./tabs/EditeurTab";
import { EspacesTab } from "./tabs/EspacesTab";
import { NavigateurTab } from "./tabs/NavigateurTab";
import { VaultTab } from "./tabs/VaultTab";

type Tab = "editeur" | "navigateur" | "espaces" | "vault" | "auteur";

const TABS: {
  value: Tab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { value: "editeur", label: "Éditeur", Icon: IconTextformat },
  { value: "navigateur", label: "Navigateur", Icon: IconListBullet },
  { value: "espaces", label: "Espaces", Icon: IconRectangleStack },
  { value: "vault", label: "Vault", Icon: IconFolder },
  { value: "auteur", label: "Auteur", Icon: IconTextDocument },
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
      className={clsx(
        "fixed inset-0 z-9999 flex items-center justify-center",
        "bg-overlay"
      )}
      onClick={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <div
        className={clsx(
          "rounded-xl shadow-xl w-130 h-150 flex flex-col overflow-hidden",
          "bg-surface"
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="relative flex items-center justify-center px-6 pt-5 pb-1 shrink-0">
          <h2
            className={clsx(
              "text-[13px] font-semibold tracking-wide uppercase",
              "text-ink-3"
            )}
          >
            Réglages
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={clsx(
              "absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-default",
              "text-ink-4",
              "hover:text-ink-2 hover:bg-surface-3"
            )}
            aria-label="Fermer"
          >
            <IconXmark className="size-3.5" />
          </button>
        </div>

        {/* Barre de tabs — même style que la TabBar des onglets */}
        <div className="mx-6 mt-3 mb-3 shrink-0">
          <SegmentedControl
            options={TABS}
            value={activeTab}
            onChange={setActiveTab}
            variant="pill"
          />
        </div>

        <div className={clsx("h-px shrink-0 mx-1", "bg-surface-3")} />

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
