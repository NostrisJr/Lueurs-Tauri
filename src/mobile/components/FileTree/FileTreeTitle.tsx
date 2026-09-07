import { useSetAtom } from "jotai";
import { useRef, useState } from "react";
import type { FolderNode } from "../../../shared/hooks/useFileTree";
import {
  mobileNavigateAtom,
  mobileSettingsScrollTargetAtom,
} from "../../../shared/lib/atoms";
import { useLongPress } from "../../hooks/useLongPress";
import { hapticImpact } from "../../lib/haptics";
import { FloatingCollapsibleTitle } from "../Floating/FloatingCollapsibleTitle";
import { NodePreviewCard } from "../Row";
import { RowContextMenu } from "../Row/RowContextMenu";
import { useNodeMenuActions } from "./useNodeMenuActions";

interface Props {
  folderName: string;
  currentFolder: FolderNode | null;
  collapseProgress: number;
}

// Appui long sur le titre = menu contextuel du dossier courant, ancré sur le
// titre (mêmes actions qu'un appui long sur sa rangée dans la liste parente).
// À la racine (pas de currentFolder), l'appui long ouvre directement les
// réglages des espaces — accès rapide sans passer par le menu "...". Le tap
// simple n'a aucun effet, dans un dossier comme à la racine.
export function FileTreeTitle({
  folderName,
  currentFolder,
  collapseProgress,
}: Props) {
  const navigate = useSetAtom(mobileNavigateAtom);
  const setSettingsScrollTarget = useSetAtom(mobileSettingsScrollTargetAtom);
  const buildMenuActions = useNodeMenuActions();
  const titleRef = useRef<HTMLSpanElement>(null);
  const [titleMenuRect, setTitleMenuRect] = useState<DOMRect | null>(null);

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

  return (
    <>
      <FloatingCollapsibleTitle
        ref={titleRef}
        text={folderName}
        collapseProgress={collapseProgress}
        className="cursor-pointer active:opacity-60 transition-opacity"
        {...titleLongPress}
      />

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
    </>
  );
}
