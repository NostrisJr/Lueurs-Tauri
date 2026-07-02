import clsx from "clsx";
import { useSetAtom } from "jotai";
import {
  IconDocumentBadgePlus,
  IconMagnifyingglass,
  IconRecordAudio,
  IconRectangleStack,
} from "../../../shared/components/PlatformIcon";
import { mobileNavigateAtom } from "../../../shared/lib/atoms";
import { isAndroid } from "../../../shared/lib/platform";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "../Floating/FloatingComponent";

interface Props {
  onCreateNote: () => Promise<void>;
  onCreateRecording: () => void;
}

export function FileTreeBottomBar({ onCreateNote, onCreateRecording }: Props) {
  const navigate = useSetAtom(mobileNavigateAtom);

  return (
    <div
      className={clsx(
        "px-4 flex items-center gap-2 shrink-0 h-28 w-full justify-between absolute bottom-0 bg-linear-to-t from-gray-300/90 via-gray-200/90 to-transparent via-70%",
        isAndroid ? "pb-0" : "pb-4"
      )}
    >
      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("tabs");
        }}
        className="text-amber-400 active:bg-black/5 transition-colors aspect-square justify-center items-center flex"
      >
        <IconRectangleStack className="size-6.5" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("search");
        }}
        wrapperClassName="flex-1"
      >
        <IconMagnifyingglass className="size-5 text-black shrink-0" />
        <span className="flex-1 text-gray-700 text-md">Rechercher...</span>
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateRecording();
        }}
        className="text-amber-400 active:bg-black/5 transition-colors aspect-square justify-center items-center flex"
      >
        <IconRecordAudio className="size-6" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateNote();
        }}
        className="text-amber-400 active:bg-black/5 transition-colors aspect-square justify-center items-center flex"
      >
        <IconDocumentBadgePlus className="size-6.75 -mr-0.75 -mt-0.5" />
      </FloatingComponent>
    </div>
  );
}
