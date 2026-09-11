/**
 * MobileEditorMenu.tsx
 *
 * Burger menu de l'éditeur mobile — regroupe toutes les actions secondaires
 * (annuler/rétablir, mode d'affichage, enregistrement, onglets, recherche)
 * derrière une seule icône, pour laisser la barre flottante du haut minimale
 * (chevron retour + burger uniquement). Cf. refonte UI mobile "headerless".
 */

import { useEffect, useState } from "react";
import type { Editor } from "../../../shared/components/NoteEditor/MarkdownEditor";
import {
  editorRedo,
  editorUndo,
} from "../../../shared/components/NoteEditor/lib/editorCommands";
import {
  IconArrowUturnBackward,
  IconArrowUturnForward,
  IconEllipsis,
  IconGearshape,
  IconMagnifyingglass,
  IconRecordAudio,
} from "../../../shared/components/PlatformIcon";
import type { DisplayMode } from "../../../shared/lib/atoms";
import { DISPLAY_MODES } from "../../../shared/lib/displayModes";
import { iconAccentClass } from "../../../shared/lib/platform";
import { openSearchBar } from "../../../shared/plugins/search/searchState";
import { hapticImpact } from "../../lib/haptics";

const MENU_ANIM_MS = 180;

interface Props {
  editorRef: React.MutableRefObject<Editor | null>;
  isBase: boolean;
  isReadOnly: boolean;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onRecord: () => void;
  onOpenSettings: () => void;
}

export function MobileEditorMenu({
  editorRef,
  isBase,
  isReadOnly,
  displayMode,
  onDisplayModeChange,
  onRecord,
  onOpenSettings,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setRendered(false), MENU_ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);

  function runAndClose(action: () => void) {
    hapticImpact("light");
    setOpen(false);
    action();
  }

  const currentEntry =
    DISPLAY_MODES.find((m) => m.value === displayMode) ?? DISPLAY_MODES[0];
  const nextEntry =
    DISPLAY_MODES.find((m) => m.value !== displayMode) ?? DISPLAY_MODES[1];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setOpen((v) => !v);
        }}
        className={`w-8 h-8 flex items-center justify-center rounded-full ${iconAccentClass} active:bg-black/5 transition-colors`}
        aria-label="Menu"
      >
        <IconEllipsis className="size-5" />
      </button>

      {rendered && (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile de fermeture */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.01)" }}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50">
            <div
              className="absolute inset-0 rounded-2xl shadow-xl"
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                border: "1px solid rgba(0,0,0,0.06)",
                transformOrigin: "top right",
                transform: visible ? "scale(1)" : "scale(0.85)",
                opacity: visible ? 1 : 0,
                transition: `transform ${MENU_ANIM_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${MENU_ANIM_MS}ms ease-out`,
              }}
            />
            <div
              className="relative rounded-2xl overflow-hidden py-1"
              style={{
                minWidth: 230,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(-6px)",
                transition: "opacity 100ms ease-out, transform 100ms ease-out",
              }}
            >
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => runAndClose(() => editorUndo(editorRef))}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 disabled:opacity-30 transition-colors"
              >
                <IconArrowUturnBackward className="size-4 text-gray-500" />
                Annuler
              </button>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => runAndClose(() => editorRedo(editorRef))}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 disabled:opacity-30 transition-colors"
              >
                <IconArrowUturnForward className="size-4 text-gray-500" />
                Rétablir
              </button>
              {!isBase && (
                <button
                  type="button"
                  onClick={() =>
                    runAndClose(() => onDisplayModeChange(nextEntry.value))
                  }
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
                >
                  <currentEntry.Icon className="size-4 text-gray-500" />
                  Affichage : {currentEntry.label}
                </button>
              )}
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => runAndClose(onRecord)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
                >
                  <IconRecordAudio className="size-4 text-gray-500" />
                  Ajouter un enregistrement
                </button>
              )}
              <button
                type="button"
                onClick={() => runAndClose(openSearchBar)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-900 active:bg-black/5 transition-colors"
              >
                <IconMagnifyingglass className="size-4 text-gray-500" />
                Rechercher et remplacer
              </button>
              <button
                type="button"
                onClick={() => runAndClose(onOpenSettings)}
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
  );
}
