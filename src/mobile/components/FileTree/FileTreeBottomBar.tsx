import {
  sfDocumentBadgePlus,
  sfMagnifyingglass,
  sfMicrophoneFill,
  sfRectangleStack,
} from "@bradleyhodges/sfsymbols";
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { useSetAtom } from "jotai";
import { mobileNavigateAtom } from "../../../shared/lib/Atoms";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "../Floating/FloatingComponent";

interface Props {
  onCreateNote: () => Promise<void>;
  onCreateRecording: () => void;
}

export function FileTreeBottomBar({ onCreateNote, onCreateRecording }: Props) {
  const navigate = useSetAtom(mobileNavigateAtom);

  return (
    <div className="px-4 flex items-center gap-3 shrink-0 h-20 pb-4 w-full justify-between absolute bottom-0 bg-linear-to-t from-gray-100/95 via-gray-100/60 to-transparent">
      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("tabs");
        }}
        className="text-amber-500 active:bg-black/5 transition-colors"
      >
        <SFIcon icon={sfRectangleStack} className="size-6.5" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("search");
        }}
        className="flex-1"
      >
        <SFIcon
          icon={sfMagnifyingglass}
          className="size-5 text-black shrink-0"
        />
        <span className="flex-1 text-gray-700 text-md">Rechercher...</span>
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateRecording();
        }}
        className="text-amber-500 active:bg-black/5 transition-colors"
      >
        <SFIcon icon={sfMicrophoneFill} className="size-6" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateNote();
        }}
        className="text-amber-500 active:bg-black/5 transition-colors"
      >
        <SFIcon
          icon={sfDocumentBadgePlus}
          className="size-6.5 -mr-0.5 -mt-0.5"
        />
      </FloatingComponent>
    </div>
  );
}
