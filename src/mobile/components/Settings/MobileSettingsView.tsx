import { useAtom, useAtomValue } from "jotai";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { IconChevronLeft } from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  allFoldersAtom,
  defaultDisplayModeAtom,
  defaultHighlightColorAtom,
  dictaphoneRelPathAtom,
  folderPathAtom,
  inboxRelPathAtom,
  mobileGoBackAtom,
  showResourcesAtom,
  textJustificationAtom,
  treeAtom,
} from "../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import { flattenTree } from "../../../shared/lib/fileTreeHelpers";
import { isAndroid } from "../../../shared/lib/platform";
import { vaultIO } from "../../../shared/lib/vaultIO";
import { HIGHLIGHT_COLORS } from "../../../shared/plugins/highlight/colors";
import { hapticImpact } from "../../lib/haptics";
import { vaultDisplayName } from "../../lib/vault";
import { MobileSplashScreen } from "../Splash/MobileSplashScreen";
import { MobileEspacesSection } from "./MobileEspacesSection";

const descriptions: Record<string, string> = {
  normal: "Sans empattement, aligné à gauche",
  livre: "Serif, indentation",
};

export function MobileSettingsView() {
  const [defaultDisplayMode, setDefaultDisplayMode] = useAtom(
    defaultDisplayModeAtom
  );
  const [defaultHighlightColor, setDefaultHighlightColor] = useAtom(
    defaultHighlightColorAtom
  );
  const [textJustification, setTextJustification] = useAtom(
    textJustificationAtom
  );
  const [showResources, setShowResources] = useAtom(showResourcesAtom);
  const [inboxRelPath, setInboxRelPath] = useAtom(inboxRelPathAtom);
  const [dictaphoneRelPath, setDictaphoneRelPath] = useAtom(dictaphoneRelPathAtom);
  const allFolders = useAtomValue(allFoldersAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const tree = useAtomValue(treeAtom);
  const { pickFolder, reload } = useFileTree();

  type CleanStatus = null | "running" | { count: number } | "error";
  const [cleanStatus, setCleanStatus] = useState<CleanStatus>(null);
  const [showSplash, setShowSplash] = useState(false);

  async function handleCleanResources() {
    if (!folderPath) return;
    setCleanStatus("running");
    try {
      const notes = flattenTree(tree);
      const referenced = new Set<string>();
      const RE = /resources\/(?:images|audio)\/([^)\s"'\]\\]+)/g;
      for (const note of notes) {
        for (const m of note.body.matchAll(RE)) referenced.add(m[1]);
      }
      let count = 0;
      for (const sub of ["images", "audio"] as const) {
        try {
          const entries = await vaultIO.readDir(
            `${folderPath}/resources/${sub}`
          );
          for (const e of entries) {
            if (!e.isDir && !referenced.has(e.name)) {
              await vaultIO.delete(e.uri);
              count++;
            }
          }
        } catch {
          /* dossier absent */
        }
      }
      setCleanStatus({ count });
    } catch {
      setCleanStatus("error");
    }
  }

  return (
    <div className="flex flex-col h-full w-full fixed bg-gray-100">
      {/* Header */}
      <div className="flex items-center w-full justify-between px-2 py-2 border-b bg-white border-gray-100 fixed top-0 pt-12 z-30">
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            goBack();
          }}
          className="flex-1 justify-start flex items-center gap-1 px-2 py-1.5 rounded-lg text-amber-500 active:bg-gray-100 transition-colors"
        >
          <IconChevronLeft className="size-4" />
          <span className="text-base">Notes</span>
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-gray-900 pr-16">
          Réglages
        </h1>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-auto pt-28 px-4 pb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 px-1">
          Mode de lecture par défaut
        </p>
        <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}>
          <Squircle
            radius={18}
            className="overflow-hidden bg-white border border-gray-100"
          >
            {DISPLAY_MODES.map(({ value, Icon, label }, i) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  setDefaultDisplayMode(value);
                }}
                className={`w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors ${
                  i < DISPLAY_MODES.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <Icon
                  className="size-5 text-gray-400 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base text-gray-900">{label}</p>
                  <p className="text-sm text-gray-400">{descriptions[value]}</p>
                </div>
                {defaultDisplayMode === value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                )}
              </button>
            ))}
          </Squircle>
        </div>
        <p className="mt-2 text-xs text-gray-400 px-1">
          Appliqué aux nouvelles notes et aux notes sans mode défini.
        </p>

        {/* Justification du texte en mode livre */}
        <div
          className="mt-4"
          style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}
        >
          <Squircle
            radius={18}
            className="overflow-hidden bg-white border border-gray-100"
          >
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setTextJustification((v) => !v);
              }}
              className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-900">
                  Justifier le texte en mode livre
                </p>
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors shrink-0 ${
                  textJustification ? "bg-amber-500" : "bg-gray-200"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow m-0.5 transition-transform ${
                    textJustification ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </button>
          </Squircle>
        </div>

        {/* Couleur de surlignage par défaut */}
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
          Couleur de surlignage par défaut
        </p>
        <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}>
          <Squircle
            radius={18}
            className="overflow-hidden bg-white border border-gray-100 px-4 py-4"
          >
            <div className="flex gap-3 flex-wrap">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    hapticImpact("light");
                    setDefaultHighlightColor(c.id);
                  }}
                  className="relative w-8 h-8 rounded-full border-2 transition-all active:scale-110"
                  style={{
                    background: c.solid,
                    borderColor:
                      defaultHighlightColor === c.id
                        ? "#374151"
                        : "transparent",
                  }}
                >
                  {defaultHighlightColor === c.id && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Squircle>
        </div>

        {/* Ressources */}
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
          Ressources
        </p>
        <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}>
          <Squircle
            radius={18}
            className="overflow-hidden bg-white border border-gray-100"
          >
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setShowResources((v) => !v);
                reload();
              }}
              className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-900">
                  Afficher les ressources
                </p>
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors shrink-0 ${showResources ? "bg-amber-500" : "bg-gray-200"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow m-0.5 transition-transform ${showResources ? "translate-x-5" : "translate-x-0"}`}
                />
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                handleCleanResources();
              }}
              disabled={cleanStatus === "running" || !folderPath}
              className="w-full flex items-center justify-between px-4 py-4 text-left active:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <p className="text-base text-gray-900">
                {cleanStatus === "running"
                  ? "Nettoyage…"
                  : "Nettoyer les ressources"}
              </p>
              {cleanStatus !== null && cleanStatus !== "running" && (
                <span className="text-sm text-gray-400">
                  {cleanStatus === "error"
                    ? "Erreur"
                    : cleanStatus.count === 0
                      ? "Rien à nettoyer"
                      : `${cleanStatus.count} supprimé${cleanStatus.count > 1 ? "s" : ""}`}
                </span>
              )}
            </button>
          </Squircle>
        </div>

        {/* Dossiers par défaut */}
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
          Dossiers par défaut
        </p>
        <div style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}>
          <Squircle
            radius={18}
            className="overflow-hidden bg-white border border-gray-100"
          >
            <div className="px-4 py-3.5 border-b border-gray-100">
              <p className="text-base text-gray-900 mb-1.5">Inbox</p>
              <select
                value={inboxRelPath ?? ""}
                onChange={(e) => {
                  hapticImpact("light");
                  setInboxRelPath(e.target.value || null);
                }}
                className="w-full text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
              >
                <option value="">Racine du vault</option>
                {allFolders.map((folder) => {
                  const rel = folderPath
                    ? folder.id.slice(folderPath.length + 1)
                    : folder.id;
                  return (
                    <option key={folder.id} value={rel}>
                      {rel}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                Destination des nouvelles notes (bouton + et raccourcis).
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-base text-gray-900 mb-1.5">Dictaphone</p>
              <select
                value={dictaphoneRelPath ?? ""}
                onChange={(e) => {
                  hapticImpact("light");
                  setDictaphoneRelPath(e.target.value || null);
                }}
                className="w-full text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
              >
                <option value="">Racine du vault</option>
                {allFolders.map((folder) => {
                  const rel = folderPath
                    ? folder.id.slice(folderPath.length + 1)
                    : folder.id;
                  return (
                    <option key={folder.id} value={rel}>
                      {rel}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                Destination des enregistrements dictaphone.
              </p>
            </div>
          </Squircle>
        </div>

        <MobileEspacesSection />

        {import.meta.env.DEV && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
              Développement
            </p>
            <div
              style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}
            >
              <Squircle
                radius={18}
                className="overflow-hidden bg-white border border-gray-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    setShowSplash(true);
                  }}
                  className="w-full px-4 py-4 text-left text-base text-gray-900 active:bg-gray-50 transition-colors"
                >
                  Aperçu du splash screen
                </button>
              </Squircle>
            </div>
          </>
        )}

        {isAndroid && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-8 mb-3 px-1">
              Vault
            </p>
            <div
              style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.06))" }}
            >
              <Squircle
                radius={18}
                className="overflow-hidden bg-white border border-gray-100"
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Dossier racine</p>
                  <p className="text-sm text-gray-700 truncate">
                    {folderPath ? vaultDisplayName(folderPath) : "–"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    pickFolder();
                  }}
                  className="w-full px-4 py-4 text-left text-base text-amber-500 active:bg-gray-50 transition-colors"
                >
                  Changer de dossier
                </button>
              </Squircle>
            </div>
          </>
        )}
      </div>

      {showSplash && (
        <>
          <MobileSplashScreen visible={true} />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: zone de fermeture dev */}
          <div
            className="fixed inset-0 z-[51]"
            onClick={() => setShowSplash(false)}
          />
        </>
      )}
    </div>
  );
}
