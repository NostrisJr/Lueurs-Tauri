import { useSetAtom } from "jotai";
import type { NoteFile } from "../../shared/hooks/useFileTree";
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

  return (note: NoteFile) => {
    setNoteBackStack([]);
    setOpenTabIds((prev) =>
      prev.includes(note.id) ? prev : [...prev, note.id]
    );
    setActiveNoteId(note.id);
    navigate("editor");
  };
}
