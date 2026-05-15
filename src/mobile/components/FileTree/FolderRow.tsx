import { sfChevronRight, sfFolder } from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import type { FolderNode } from "../../../shared/hooks/useFileTree";
import { useLongPress } from "../../hooks/useLongPress";

interface Props {
  folder: FolderNode;
  onDrillIn: (folder: FolderNode) => void;
  onLongPress: () => void;
}

export function FolderRow({ folder, onDrillIn, onLongPress }: Props) {
  const longPress = useLongPress(onLongPress);

  return (
    <button
      type="button"
      onClick={() => onDrillIn(folder)}
      {...longPress}
      className="w-full flex items-center gap-3 shadow-xs bg-white rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all"
    >
      <SFIcon icon={sfFolder} className="size-4 text-yellow-500 shrink-0" />
      <span className="flex-1 text-base font-semibold text-gray-900 truncate">
        {folder.name}
      </span>
      <SFIcon
        icon={sfChevronRight}
        className="size-3.5 text-gray-300 shrink-0"
      />
    </button>
  );
}
