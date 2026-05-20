import clsx from "clsx";
import { useSetAtom } from "jotai";
import {
  IconDocumentBadgePlus,
  IconMagnifyingglass,
  IconMicrophoneFill,
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
        "px-4 flex items-center gap-3 shrink-0 h-20 w-full justify-between absolute bottom-0 bg-linear-to-t from-gray-100/95 via-gray-100/60 to-transparent",
        isAndroid ? "pb-0" : "pb-4"
      )}
    >
      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("tabs");
        }}
        className="text-amber-400 active:bg-black/5 transition-colors"
        bgColor="rgba(255, 255, 255, 0.6)"
      >
        <IconRectangleStack className="size-6.5" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("search");
        }}
        className="flex-1"
        bgColor="rgba(255, 255, 255, 0.6)"
      >
        <IconMagnifyingglass className="size-5 text-black shrink-0" />
        <span className="flex-1 text-gray-700 text-md">Rechercher...</span>
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateRecording();
        }}
        className="text-amber-400 active:bg-black/5 transition-colors"
        bgColor="rgba(255, 255, 255, 0.6)"
      >
        <IconMicrophoneFill className="size-6" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateNote();
        }}
        className="text-amber-400 active:bg-black/5 transition-colors"
        bgColor="rgba(255, 255, 255, 0.6)"
      >
        <IconDocumentBadgePlus className="size-6.5 -mr-0.5 -mt-0.5" />
      </FloatingComponent>
    </div>
  );
}
