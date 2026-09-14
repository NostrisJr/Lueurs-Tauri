import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import {
  IconDocumentBadgePlus,
  IconMagnifyingglass,
  IconRecordAudio,
  IconRectangleStack,
} from "../../../shared/components/PlatformIcon";
import { mobileNavigateAtom, openTabIdsAtom } from "../../../shared/lib/atoms";
import { iconAccentClass, isAndroid } from "../../../shared/lib/platform";
import { hapticImpact } from "../../lib/haptics";
import { FloatingComponent } from "../Floating/FloatingComponent";

interface Props {
  onCreateNote: () => Promise<void>;
  onCreateRecording: () => void;
}

export function FileTreeBottomBar({ onCreateNote, onCreateRecording }: Props) {
  const navigate = useSetAtom(mobileNavigateAtom);
  const openTabIds = useAtomValue(openTabIdsAtom);

  return (
    <div
      className={clsx(
        "px-4 flex items-center gap-2 shrink-0 h-28 w-full justify-between absolute bottom-0",
        isAndroid ? "pb-0" : "pb-4"
      )}
      // Dégradé en style plutôt qu'en classes : les tokens --bar-fade portent
      // déjà leur alpha, et `from-x/90` passerait par color-mix(oklab), non
      // supporté par certaines WebView Android (cf. FloatingComponent).
      style={{
        backgroundImage:
          "linear-gradient(to top, var(--bar-fade) 0%, var(--bar-fade-2) 70%, transparent 100%)",
      }}
    >
      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("tabs");
        }}
        className={clsx(
          iconAccentClass,
          "active:bg-tint transition-colors aspect-square justify-center items-center flex"
        )}
      >
        <IconRectangleStack className="size-6.5" />
        {openTabIds.length > 1 && (
          <span
            className={clsx(
              "absolute top-1.75 right-1.75 text-xs rounded-full size-4 flex items-center justify-center leading-none",
              "bg-accent-2 text-on-inverse"
            )}
          >
            {openTabIds.length}
          </span>
        )}
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          navigate("search");
        }}
        wrapperClassName="flex-1"
      >
        <IconMagnifyingglass className="size-5 text-ink shrink-0" />
        <span className="flex-1 text-ink-2 text-md">Rechercher...</span>
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateRecording();
        }}
        className={clsx(
          iconAccentClass,
          "active:bg-tint transition-colors aspect-square justify-center items-center flex"
        )}
      >
        <IconRecordAudio className="size-6" />
      </FloatingComponent>

      <FloatingComponent
        onClick={() => {
          hapticImpact("light");
          onCreateNote();
        }}
        className={clsx(
          iconAccentClass,
          "active:bg-tint transition-colors aspect-square justify-center items-center flex"
        )}
      >
        <IconDocumentBadgePlus className="size-6.75 -mr-0.75 -mt-0.5" />
      </FloatingComponent>
    </div>
  );
}
