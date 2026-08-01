import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconDocumentBadgePlus,
  IconEllipsis,
  IconFolderBadgePlus,
  IconGearshape,
} from "../../../shared/components/PlatformIcon";
import { useFileTree } from "../../../shared/hooks/useFileTree";
import {
  activeSpaceAtom,
  folderPathAtom,
  folderStackAtom,
  inboxAbsPathAtom,
  mobileNavigateAtom,
  mobileSettingsScrollTargetAtom,
  vaultConfigAtom,
} from "../../../shared/lib/atoms";
import { iconAccentClass, isIOS } from "../../../shared/lib/platform";
import { useLongPress } from "../../hooks/useLongPress";
import { useMobileSelectNote } from "../../hooks/useMobileSelectNote";
import { hapticImpact } from "../../lib/haptics";
import { vaultDisplayName } from "../../lib/vault";
import { NodePreviewCard } from "../Row";
import { RowContextMenu } from "../Row/RowContextMenu";
import { useNodeMenuActions } from "./useNodeMenuActions";

interface Props {
  /** Un déplacement est en cours : la flèche de retour devient une cible de dépôt. */
  dragActive?: boolean;
  /** Le doigt survole cette cible. */
  dropOverParent?: boolean;
  /** Nom du dossier parent. Absent = le parent est la racine, on reprend alors
   * le libellé déjà calculé ici (nom de l'espace ou du vault). */
  parentName?: string;
}

export function FileTreeHeader({
  dragActive,
  dropOverParent,
  parentName,
}: Props) {
  const folderStack = useAtomValue(folderStackAtom);
  const setFolderStack = useSetAtom(folderStackAtom);
  const folderPath = useAtomValue(folderPathAtom);
  const inboxPath = useAtomValue(inboxAbsPathAtom);
  const navigate = useSetAtom(mobileNavigateAtom);
  const setSettingsScrollTarget = useSetAtom(mobileSettingsScrollTargetAtom);
  const activeSpace = useAtomValue(activeSpaceAtom);
  const vaultConfig = useAtomValue(vaultConfigAtom);
  const { createNote, createFolder } = useFileTree();
  const selectNote = useMobileSelectNote();

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Menu contextuel du dossier courant, ancré sur le titre.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titleMenuRect, setTitleMenuRect] = useState<DOMRect | null>(null);
  const buildMenuActions = useNodeMenuActions();
  // Monté puis rendu visible une frame plus tard (cf. MobileFormattingBar) pour que
  // la transition CSS ait deux états distincts à interpoler à l'ouverture comme à
  // la fermeture, plutôt qu'un menu qui apparaît/disparaît d'un coup.
  const [menuRendered, setMenuRendered] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const MENU_ANIM_MS = 180;
  // Le contenu (texte/icônes) doit disparaître plus vite que le fond flouté à la
  // fermeture, sinon il semble "traîner" derrière l'animation du conteneur.
  const MENU_TEXT_ANIM_MS = 100;

  useEffect(() => {
    if (showMenu) {
      setMenuRendered(true);
      const raf = requestAnimationFrame(() => setMenuVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setMenuVisible(false);
    const t = setTimeout(() => setMenuRendered(false), MENU_ANIM_MS);
    return () => clearTimeout(t);
  }, [showMenu]);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;
  const canGoBack = folderStack.length > 1;
  const vaultName = folderPath ? vaultDisplayName(folderPath) : undefined;
  // À la racine d'un espace : nom (et emoji) de l'espace au lieu du nom du vault
  const space = activeSpace
    ? vaultConfig?.spaces.find((s) => s.name === activeSpace)
    : undefined;
  const hasToutMode = vaultConfig && vaultConfig.spaces.length > 0;
  const toutIcon = vaultConfig?.toutIcon;
  // vaultConfig=null → encore en chargement : ne pas afficher le nom du vault pour
  // éviter le flash "Documents" → "Tout" pendant l'hydratation asynchrone.
  const rootName = space
    ? `${space.icon ? `${space.icon} ` : ""}${space.name}`
    : hasToutMode
      ? `${toutIcon ? `${toutIcon} ` : ""}Tout`
      : vaultConfig !== null
        ? (vaultName ?? "Notes")
        : "";
  const folderName = currentFolder?.name ?? rootName;

  function handleDrillOut() {
    hapticImpact("light");
    setFolderStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  async function handleCreateNote() {
    setShowMenu(false);
    hapticImpact("light");
    const path = currentFolder?.id ?? inboxPath ?? folderPath ?? "";
    const note = await createNote(path, activeSpace);
    selectNote(note);
  }

  async function handleCreateFolder() {
    setShowMenu(false);
    hapticImpact("light");
    const path = currentFolder?.id ?? folderPath ?? "";
    await createFolder(path, activeSpace);
  }

  function handleOpenSettings() {
    setShowMenu(false);
    hapticImpact("light");
    setSettingsScrollTarget(null);
    navigate("settings");
  }

  // Appui long sur le titre = menu contextuel du dossier courant, ancré sur le
  // titre (mêmes actions qu'un appui long sur sa rangée dans la liste parente).
  // À la racine (pas de currentFolder), l'appui long ouvre directement les
  // réglages des espaces — accès rapide sans passer par le menu "...". Le tap
  // simple n'a plus d'effet, dans un dossier comme à la racine.
  function handleTitleLongPress() {
    if (currentFolder) {
      if (!titleRef.current) return;
      hapticImpact("light");
      setTitleMenuRect(titleRef.current.getBoundingClientRect());
      return;
    }
    hapticImpact("medium");
    setSettingsScrollTarget("espaces");
    navigate("settings");
  }

  const titleLongPress = useLongPress(handleTitleLongPress, () => {});

  // Listener attaché systématiquement, gating à l'intérieur, pour garantir la
  // symétrie attach/detach même si le composant se démonte avec showMenu=true.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!showMenu) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <div
      className={clsx(
        "px-5 pb-2 flex items-end justify-between",
        isIOS ? "pt-4" : "pt-0"
      )}
    >
      {canGoBack ? (
        // Pendant un déplacement, ce bouton n'est plus une navigation mais la
        // cible de dépôt du dossier parent : il s'élargit et affiche son nom
        // pour se lire comme une destination, pas comme un retour.
        <div
          data-dropzone-parent={dragActive ? "" : undefined}
          className={clsx(
            "h-8 flex items-center rounded-full transition-all",
            dragActive && "px-2 gap-1 max-w-[45%] border border-dashed",
            dropOverParent
              ? "bg-amber-100 border-amber-400"
              : dragActive
                ? "bg-gray-50 border-gray-300"
                : "border-transparent"
          )}
        >
          <button
            type="button"
            onClick={handleDrillOut}
            className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
          >
            <IconChevronLeft className="size-4" />
          </button>
          {dragActive && (
            <span className="text-xs font-medium text-gray-600 truncate pr-1">
              {parentName ?? rootName}
            </span>
          )}
        </div>
      ) : (
        <div className="w-8 h-8" />
      )}

      <h1
        ref={titleRef}
        className="w-3/4 text-2xl text-center text-gray-900 font-semibold tracking-tight cursor-pointer active:opacity-60 transition-opacity whitespace-nowrap text-ellipsis overflow-hidden"
        {...titleLongPress}
      >
        {folderName}
      </h1>

      {currentFolder && titleMenuRect && (
        <RowContextMenu
          rect={titleMenuRect}
          config={{
            preview: <NodePreviewCard node={currentFolder} />,
            ...buildMenuActions(currentFolder),
          }}
          phase="open"
          dragPoint={null}
          onDismiss={() => setTitleMenuRect(null)}
          // On est déjà dans ce dossier : le tap sur l'aperçu ne fait que fermer.
          onActivate={() => setTitleMenuRect(null)}
          onDragBegin={() => {}}
          onDragUpdate={() => {}}
          onDragFinish={() => {}}
        />
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            hapticImpact("light");
            setShowMenu((v) => !v);
          }}
          className={`w-8 h-8 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
          aria-label="Menu"
        >
          <IconEllipsis className="size-5" />
        </button>

        {menuRendered && (
          <>
            {/* Dropplane quasi-transparent : un tap ailleurs ferme le menu sans
                jamais atteindre ce qu'il y a en dessous (note, titre…). */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile de fermeture */}
            <div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.01)" }}
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-10 z-50">
              {/* Fond flouté : seul calque scalé. Le texte (calque séparé
                  ci-dessous) n'est jamais mis à l'échelle, sinon son rendu
                  "tressaute" pendant la transition (sous-pixel + backdrop-filter
                  recalculé à chaque frame de scale). */}
              <div
                className="absolute inset-0 rounded-2xl shadow-xl"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  transformOrigin: "top right",
                  transform: menuVisible ? "scale(1)" : "scale(0.85)",
                  opacity: menuVisible ? 1 : 0,
                  transition: `transform ${MENU_ANIM_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${MENU_ANIM_MS}ms ease-out`,
                  willChange: "transform, opacity",
                }}
              />
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  minWidth: 200,
                  opacity: menuVisible ? 1 : 0,
                  transform: menuVisible ? "translateY(0)" : "translateY(-6px)",
                  transition: `opacity ${MENU_TEXT_ANIM_MS}ms ease-out, transform ${MENU_TEXT_ANIM_MS}ms ease-out`,
                }}
              >
                <button
                  type="button"
                  onClick={handleCreateNote}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors border-b border-black/5"
                >
                  <IconDocumentBadgePlus className="size-4 text-blue-500" />
                  Nouvelle note
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors border-b border-black/5"
                >
                  <IconFolderBadgePlus className="size-4 text-yellow-500" />
                  Nouveau dossier
                </button>
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
                >
                  <IconGearshape className="size-4 text-gray-500" />
                  Réglages
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
