import { useAtomValue, useSetAtom } from "jotai";
import { openTabIdsAtom, mobileViewAtom } from "../../../lib/atoms.ts";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import {
  sfDocumentBadgePlus,
  sfMagnifyingglass,
  sfRectangleStack,
} from "@bradleyhodges/sfsymbols";

interface Props {
  onCreateNote: () => Promise<void>;
  onOpenSearch: () => void;
}

export function FileTreeBottomBar({ onCreateNote, onOpenSearch }: Props) {
  const openTabIds = useAtomValue(openTabIdsAtom);
  const setMobileView = useSetAtom(mobileViewAtom);

  return (
    <div className="px-4 flex items-center gap-3 shrink-0 h-20 pb-4 w-full justify-between absolute bottom-0 bg-linear-to-t from-gray-100/95 via-gray-100/60 to-transparent">
      <button
        type="button"
        onClick={() => setMobileView("tabs")}
        className="relative size-12 shrink-0 flex items-center bg-transparent justify-center rounded-full text-amber-500 active:bg-black/5 transition-colors liquid-glass"
      >
        <SFIcon icon={sfRectangleStack} className="size-6" />
        {openTabIds.length > 1 && (
          <span className="absolute -top-0.5 -right-0.5 z-30 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {openTabIds.length}
          </span>
        )}
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <div
        className="flex-1 h-12 flex items-center gap-3 px-3 py-2 rounded-full liquid-glass"
        onClick={onOpenSearch}
        tabIndex={-1}
      >
        <SFIcon
          icon={sfMagnifyingglass}
          className="size-4 text-black shrink-0"
        />
        <span className="flex-1 text-gray-700 text-md">Rechercher...</span>
      </div>

      <button
        type="button"
        onClick={onCreateNote}
        className="size-12 flex items-center justify-center rounded-full liquid-glass text-amber-500 active:bg-black/5 transition-colors"
      >
        <SFIcon
          icon={sfDocumentBadgePlus}
          className="size-6.5 -mr-0.5 -mt-0.5"
        />
      </button>
    </div>
  );
}
