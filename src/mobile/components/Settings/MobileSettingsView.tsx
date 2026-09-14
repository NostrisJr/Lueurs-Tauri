import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
} from "../../../shared/components/PlatformIcon";
import { Squircle } from "../../../shared/components/Squircle";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  MAILBOX_DEFAULT_FOLDER_NAME,
  type MailboxMode,
  SPELLCHECK_ENGINES,
  allFoldersAtom,
  defaultDisplayModeAtom,
  defaultHighlightColorAtom,
  dictaphoneRelPathAtom,
  folderPathAtom,
  inboxRelPathAtom,
  mailboxCustomRelPathAtom,
  mailboxModeAtom,
  mobileGoBackAtom,
  mobileNavigateAtom,
  mobilePrevViewAtom,
  mobileSettingsScrollTargetAtom,
  showResourcesAtom,
  spellcheckEngineAtom,
  textJustificationAtom,
  themePreferenceAtom,
  treeAtom,
} from "../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import { flattenTree } from "../../../shared/lib/fileTreeHelpers";
import {
  iconAccentClass,
  isAndroid,
  isIOS,
} from "../../../shared/lib/platform";
import { THEME_OPTIONS } from "../../../shared/lib/theme";
import { vaultIO } from "../../../shared/lib/vaultIO";
import {
  HIGHLIGHT_COLORS,
  getHighlightSolid,
} from "../../../shared/plugins/highlight/colors";
import { useKeyboard } from "../../hooks/useKeyboard";
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
  const [spellcheckEngine, setSpellcheckEngine] = useAtom(spellcheckEngineAtom);
  const [themePreference, setThemePreference] = useAtom(themePreferenceAtom);
  const [showResources, setShowResources] = useAtom(showResourcesAtom);
  const [inboxRelPath, setInboxRelPath] = useAtom(inboxRelPathAtom);
  const [dictaphoneRelPath, setDictaphoneRelPath] = useAtom(
    dictaphoneRelPathAtom
  );
  const [mailboxMode, setMailboxMode] = useAtom(mailboxModeAtom);
  const [mailboxCustomRelPath, setMailboxCustomRelPath] = useAtom(
    mailboxCustomRelPathAtom
  );
  const allFolders = useAtomValue(allFoldersAtom);
  const goBack = useSetAtom(mobileGoBackAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const prevView = useAtomValue(mobilePrevViewAtom);
  // Réglages est accessible depuis le file tree ET depuis l'éditeur (menu
  // "..." de la note) : le libellé du bouton retour reflète l'écran réel vers
  // lequel `goBack()` va revenir, plutôt qu'un "Notes" figé.
  const backLabel = prevView === "editor" ? "Note" : "Notes";
  const folderPath = useAtomValue(folderPathAtom);
  const tree = useAtomValue(treeAtom);
  const { pickFolder, reload } = useFileTree();
  const { height: keyboardHeight, isOpen: isKeyboardOpen } = useKeyboard();
  const [scrollTarget, setScrollTarget] = useAtom(
    mobileSettingsScrollTargetAtom
  );

  type CleanStatus = null | "running" | { count: number } | "error";
  const [cleanStatus, setCleanStatus] = useState<CleanStatus>(null);
  const [showSplash, setShowSplash] = useState(false);

  // Cible de scroll consommée une seule fois au montage (accès rapide depuis un
  // appui long sur le titre du file tree ou le sélecteur d'espaces).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ne doit s'exécuter qu'au montage
  useEffect(() => {
    if (scrollTarget !== "espaces") return;
    document
      .getElementById("settings-espaces-section")
      ?.scrollIntoView({ behavior: "auto", block: "start" });
    setScrollTarget(null);
  }, []);

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
              await vaultIO.delete(e.uri, folderPath ?? undefined, "file");
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
    <div className={clsx("flex flex-col h-full w-full fixed", "bg-surface-3")}>
      {/* Header */}
      <div
        className={clsx(
          "flex items-center w-full justify-center px-2 py-2 border-b fixed top-0 pt-14 z-30",
          "bg-surface border-line"
        )}
      >
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            goBack();
          }}
          className={clsx(
            "flex-1 justify-start fixed left-1 items-center gap-1 px-2 py-1.5 rounded-lg",
            iconAccentClass,
            "active:bg-surface-3 transition-colors z-10"
          )}
        >
          <IconChevronLeft className="size-4" />
          <span className="text-base">{backLabel}</span>
        </button>
        <h1
          className={clsx("justify-center text-2xl font-semibold", "text-ink")}
        >
          Réglages
        </h1>
      </div>

      {/* Contenu */}
      <div
        // Repéré par useMobileReorder (réordo des espaces) comme conteneur à
        // faire défiler quand le doigt atteint un bord pendant un déplacement.
        data-mobile-scroll-container=""
        className="flex-1 pt-28 px-4 overflow-auto"
        style={{
          // Padding dynamique : sans ça, un champ édité en bas de liste (ex: nom
          // d'espace) reste caché sous le clavier sans pouvoir scroller assez haut.
          paddingBottom: isKeyboardOpen ? keyboardHeight + 24 : 32,
        }}
      >
        <p
          className={clsx(
            "mb-3 px-1 text-xs font-medium uppercase tracking-wider",
            "text-ink-4"
          )}
        >
          Apparence
        </p>
        <div style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx("overflow-hidden border", "bg-surface border-line")}
          >
            {THEME_OPTIONS.map(({ value, label }, i) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  setThemePreference(value);
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-4 text-left transition-colors",
                  "active:bg-surface-2",
                  i < THEME_OPTIONS.length - 1 && "border-b border-line"
                )}
              >
                <p className={clsx("flex-1 min-w-0 text-base", "text-ink")}>
                  {label}
                </p>
                {themePreference === value && (
                  <div
                    className={clsx(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      "bg-accent"
                    )}
                  />
                )}
              </button>
            ))}
          </Squircle>
        </div>
        <p className={clsx("mt-2 mb-8 px-1 text-xs", "text-ink-4")}>
          « Système » suit le réglage clair/sombre de l'appareil.
        </p>

        <p
          className={clsx(
            "text-xs font-medium uppercase tracking-wider mb-3 px-1",
            "text-ink-4"
          )}
        >
          Mode de lecture par défaut
        </p>
        <div style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx("overflow-hidden border", "bg-surface border-line")}
          >
            {DISPLAY_MODES.map(({ value, Icon, label }, i) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  setDefaultDisplayMode(value);
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-4 text-left active:bg-surface-2 transition-colors",
                  i < DISPLAY_MODES.length - 1 ? "border-b border-line" : ""
                )}
              >
                <Icon
                  className="size-5 text-ink-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base text-ink">{label}</p>
                  <p className="text-sm text-ink-4">{descriptions[value]}</p>
                </div>
                {defaultDisplayMode === value && (
                  <div
                    className={clsx(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      "bg-accent"
                    )}
                  />
                )}
              </button>
            ))}
          </Squircle>
        </div>
        <p className={clsx("mt-2 text-xs px-1", "text-ink-4")}>
          Appliqué aux nouvelles notes et aux notes sans mode défini.
        </p>

        {/* Justification du texte en mode livre */}
        <div className="mt-4" style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx("overflow-hidden border", "bg-surface border-line")}
          >
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setTextJustification((v) => !v);
              }}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-4 text-left transition-colors",
                "active:bg-surface-2"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base text-ink">
                  Justifier le texte en mode livre
                </p>
              </div>
              <div
                className={clsx(
                  "w-11 h-6 rounded-full transition-colors shrink-0",
                  textJustification ? "bg-accent" : "bg-surface-4"
                )}
              >
                <div
                  className={clsx(
                    "w-5 h-5 rounded-full bg-surface shadow m-0.5 transition-transform",
                    textJustification ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </div>
            </button>
          </Squircle>
        </div>

        {/* Correcteur orthographique et grammatical */}
        <p
          className={clsx(
            "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
            "text-ink-4"
          )}
        >
          Correcteur orthographique et grammatical
        </p>
        <div style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx("overflow-hidden border", "bg-surface border-line")}
          >
            {SPELLCHECK_ENGINES.map(({ value, label }, i) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  hapticImpact("light");
                  setSpellcheckEngine(value);
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-4 text-left active:bg-surface-2 transition-colors",
                  i < SPELLCHECK_ENGINES.length - 1
                    ? "border-b border-line"
                    : ""
                )}
              >
                <p className={clsx("flex-1 min-w-0 text-base", "text-ink")}>
                  {label}
                </p>
                {spellcheckEngine === value && (
                  <div
                    className={clsx(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      "bg-accent"
                    )}
                  />
                )}
              </button>
            ))}
          </Squircle>
        </div>

        {/* Couleur de surlignage par défaut */}
        <p
          className={clsx(
            "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
            "text-ink-4"
          )}
        >
          Couleur de surlignage par défaut
        </p>
        <div style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx(
              "overflow-hidden border px-4 py-4",
              "bg-surface border-line"
            )}
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
                    background: getHighlightSolid(c.id),
                    borderColor:
                      defaultHighlightColor === c.id
                        ? "var(--color-ink-2)"
                        : "transparent",
                  }}
                >
                  {defaultHighlightColor === c.id && (
                    <span
                      className={clsx(
                        "absolute inset-0 flex items-center justify-center text-xs font-bold",
                        "text-on-inverse"
                      )}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Squircle>
        </div>

        {/* Ressources */}
        <p
          className={clsx(
            "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
            "text-ink-4"
          )}
        >
          Ressources
        </p>
        <div style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx("overflow-hidden border", "bg-surface border-line")}
          >
            <button
              type="button"
              onClick={() => {
                hapticImpact("light");
                setShowResources((v) => !v);
                reload();
              }}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-4 text-left transition-colors border-b",
                "border-line",
                "active:bg-surface-2"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base text-ink">Afficher les ressources</p>
              </div>
              <div
                className={clsx(
                  "w-11 h-6 rounded-full transition-colors shrink-0",
                  showResources ? "bg-accent" : "bg-surface-4"
                )}
              >
                <div
                  className={clsx(
                    "w-5 h-5 rounded-full bg-surface shadow m-0.5 transition-transform",
                    showResources ? "translate-x-5" : "translate-x-0"
                  )}
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
              className={clsx(
                "w-full flex items-center justify-between px-4 py-4 text-left transition-colors disabled:opacity-50",
                "active:bg-surface-2"
              )}
            >
              <p className="text-base text-ink">
                {cleanStatus === "running"
                  ? "Nettoyage…"
                  : "Nettoyer les ressources"}
              </p>
              {cleanStatus !== null && cleanStatus !== "running" && (
                <span className="text-sm text-ink-4">
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
        <p
          className={clsx(
            "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
            "text-ink-4"
          )}
        >
          Dossiers par défaut
        </p>
        <div style={{ filter: "var(--shadow-card)" }}>
          <Squircle
            radius={18}
            className={clsx("overflow-hidden border", "bg-surface border-line")}
          >
            <div className={clsx("px-4 py-3.5 border-b", "border-line")}>
              <p className="text-base text-ink mb-1.5">Inbox</p>
              <select
                value={inboxRelPath ?? ""}
                onChange={(e) => {
                  hapticImpact("light");
                  setInboxRelPath(e.target.value || null);
                }}
                className={clsx(
                  "w-full text-sm rounded-lg px-3 py-2 border",
                  "text-ink-3 bg-surface-2 border-line-2"
                )}
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
              <p className="text-xs text-ink-4 mt-1.5">
                Destination des nouvelles notes (bouton + et raccourcis).
              </p>
            </div>
            <div className={clsx("px-4 py-3.5 border-b", "border-line")}>
              <p className="text-base text-ink mb-1.5">Dictaphone</p>
              <select
                value={dictaphoneRelPath ?? ""}
                onChange={(e) => {
                  hapticImpact("light");
                  setDictaphoneRelPath(e.target.value || null);
                }}
                className={clsx(
                  "w-full text-sm rounded-lg px-3 py-2 border",
                  "text-ink-3 bg-surface-2 border-line-2"
                )}
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
              <p className="text-xs text-ink-4 mt-1.5">
                Destination des enregistrements dictaphone.
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-base text-ink mb-1.5">Boîte aux lettres</p>
              <div
                className={clsx(
                  "flex gap-1 rounded-lg p-0.75 border",
                  "bg-surface-2 border-line-2"
                )}
              >
                {(
                  [
                    ["recus", MAILBOX_DEFAULT_FOLDER_NAME],
                    ["racine", "Racine"],
                    ["custom", "Autre"],
                  ] as [MailboxMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      setMailboxMode(mode);
                    }}
                    className={clsx(
                      "flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition-colors",
                      mailboxMode === mode
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-4"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mailboxMode === "custom" && (
                <select
                  value={mailboxCustomRelPath ?? ""}
                  onChange={(e) => {
                    hapticImpact("light");
                    setMailboxCustomRelPath(e.target.value || null);
                  }}
                  className={clsx(
                    "w-full text-sm rounded-lg px-3 py-2 border mt-2",
                    "text-ink-3 bg-surface-2 border-line-2"
                  )}
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
              )}
              <p className="text-xs text-ink-4 mt-1.5">
                Destination des notes, dossiers et médias reçus par bundle
                partagé (.lueurs).
              </p>
            </div>
          </Squircle>
        </div>

        <div id="settings-espaces-section">
          <MobileEspacesSection />
        </div>

        {isIOS && (
          <>
            <p
              className={clsx(
                "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
                "text-ink-4"
              )}
            >
              Corbeille
            </p>
            <div style={{ filter: "var(--shadow-card)" }}>
              <Squircle
                radius={18}
                className={clsx(
                  "overflow-hidden border",
                  "bg-surface border-line"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    navigate("trash");
                  }}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-4 text-left transition-colors",
                    "active:bg-surface-2"
                  )}
                >
                  <IconTrash
                    className="size-5 text-ink-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p className={clsx("flex-1 min-w-0 text-base", "text-ink")}>
                    Corbeille
                  </p>
                  <IconChevronRight
                    className="size-4 text-ink-5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </Squircle>
            </div>
          </>
        )}

        {import.meta.env.DEV && (
          <>
            <p
              className={clsx(
                "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
                "text-ink-4"
              )}
            >
              Développement
            </p>
            <div style={{ filter: "var(--shadow-card)" }}>
              <Squircle
                radius={18}
                className={clsx(
                  "overflow-hidden border",
                  "bg-surface border-line"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    setShowSplash(true);
                  }}
                  className={clsx(
                    "w-full px-4 py-4 text-left text-base transition-colors",
                    "text-ink",
                    "active:bg-surface-2"
                  )}
                >
                  Aperçu du splash screen
                </button>
              </Squircle>
            </div>
          </>
        )}

        {isAndroid && (
          <>
            <p
              className={clsx(
                "text-xs font-medium uppercase tracking-wider mt-8 mb-3 px-1",
                "text-ink-4"
              )}
            >
              Vault
            </p>
            <div style={{ filter: "var(--shadow-card)" }}>
              <Squircle
                radius={18}
                className={clsx(
                  "overflow-hidden border",
                  "bg-surface border-line"
                )}
              >
                <div className={clsx("px-4 py-3 border-b", "border-line")}>
                  <p className="text-xs text-ink-4 mb-0.5">Dossier racine</p>
                  <p className="text-sm text-ink-2 truncate">
                    {folderPath ? vaultDisplayName(folderPath) : "–"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    pickFolder();
                  }}
                  className={clsx(
                    "w-full px-4 py-4 text-left text-base transition-colors",
                    "text-accent",
                    "active:bg-surface-2"
                  )}
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
