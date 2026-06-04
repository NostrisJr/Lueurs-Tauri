import { useSetAtom } from "jotai";
import type { MediaFile, NoteFile } from "../../shared/hooks/useFileTree";
import {
  activeNoteIdAtom,
  mobileNavigateAtom,
  noteBackStackAtom,
  openTabIdsAtom,
} from "../../shared/lib/atoms";

export function useMobileSelectNote() {
  const navigate = useSetAtom(mobileNavigateAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);

  // Ouvre une note ou un média dans les onglets (même chemin).
  return (node: NoteFile | MediaFile) => {
    setNoteBackStack([]);
    setOpenTabIds((prev) =>
      prev.includes(node.id) ? prev : [...prev, node.id]
    );
    setActiveNoteId(node.id);
    navigate("editor");
  };
}
