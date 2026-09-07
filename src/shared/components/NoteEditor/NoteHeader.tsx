import { useAtomValue } from "jotai";
import type React from "react";
import { MobileNoteTitle } from "../../../mobile/components/Editor/MobileNoteTitle.tsx";
import { type DisplayMode, activeNoteAtom } from "../../lib/atoms";
import { isMobile } from "../../lib/platform";
import { EditableText } from "../EditableText.tsx";
import { IconRecordAudio } from "../PlatformIcon.tsx";
import { DisplayModeSelector } from "./DisplayModeSelector.tsx";
import { editorFocusAtStart, type EditorRef } from "./lib/editorCommands";

interface Props {
  onRename: (newName: string) => Promise<void>;
  onDisplayModeChange?: (mode: DisplayMode) => void;
  isNote: boolean;
  onRecord?: () => void;
  /** Override du nom affiché — utilisé pour les médias où activeNoteAtom est null. */
  name?: string;
  editorRef?: EditorRef;
  /** Propriétés dépliées (mobile) — porté par NoteEditor, absent = pas de chevron (ex: médias). */
  propertiesExpanded?: boolean;
  onTogglePropertiesExpanded?: () => void;
  /** Progression (0-1) du fondu du titre dans la barre flottante (mobile), chevron masqué en fin de course. */
  titleCollapseProgress?: number;
  /** Conteneur du portail de morph du titre (mobile) — cf. MobileNoteTitle. */
  titlePortalContainer?: React.RefObject<HTMLElement | null>;
}

export function NoteHeader({
  onRename,
  onDisplayModeChange,
  isNote,
  onRecord,
  name: nameProp,
  editorRef,
  propertiesExpanded,
  onTogglePropertiesExpanded,
  titleCollapseProgress,
  titlePortalContainer,
}: Props) {
  const activeNote = useAtomValue(activeNoteAtom);

  const displayName = nameProp ?? activeNote?.name;
  if (!displayName) return null;

  // Éditeur de note mobile uniquement — la vue média (pas de propriétés) garde
  // le rendu ci-dessous, comme le desktop.
  if (isMobile && onTogglePropertiesExpanded && editorRef) {
    return (
      // px-3 aligné sur l'inset de FloatingHeaderBar : le chevron s'aligne
      // horizontalement avec le chevron retour de la barre flottante.
      <div className="w-full px-3 pt-2">
        <MobileNoteTitle
          name={displayName}
          onRename={onRename}
          editorRef={editorRef}
          expanded={!!propertiesExpanded}
          onToggleExpanded={onTogglePropertiesExpanded}
          scrollCollapseProgress={titleCollapseProgress ?? 0}
          portalContainer={titlePortalContainer}
        />
      </div>
    );
  }

  return (
    // Mobile : pas de sticky. La barre de MobileEditor est fixed/z-30 et couvre
    // top-0 — un header sticky viendrait se cacher dessous au moindre scroll,
    // titre devenu intappable. Il défile donc avec le contenu.
    <div
      className={`border-b border-gray-100 bg-white w-full flex min-w-0 px-4 py-2 text-3xl h-13 font-header text-left items-center justify-between gap-2 ${
        isMobile ? "" : "sticky top-0 z-20"
      }`}
    >
      <EditableText
        className=" hover:bg-gray-100"
        value={displayName}
        onSave={async (newName: string) => onRename(newName)}
        // Entrée valide le titre → caret en début de corps de note (comme
        // MobileNoteTitle). Absent pour les médias (pas d'éditeur associé).
        onEnterCommit={
          editorRef ? () => editorFocusAtStart(editorRef) : undefined
        }
      />
      <div className="flex items-center gap-3">
        {isNote && !isMobile && onRecord && (
          <button
            type="button"
            onClick={onRecord}
            title="Enregistrement vocal"
            className="p-0.5 text-gray-500 hover:text-red-500 transition-colors bg-transparent rounded-full size-10 flex items-center justify-center hover:bg-gray-100"
          >
            <IconRecordAudio className="size-4.5" aria-hidden="true" />
          </button>
        )}
        {isNote && !isMobile && onDisplayModeChange && (
          <DisplayModeSelector onModeChange={onDisplayModeChange} />
        )}
      </div>
    </div>
  );
}
