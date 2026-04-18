import { useSetAtom } from "jotai";
import {
  activeNoteIdAtom,
  mobileViewAtom,
  noteBackStackAtom,
  openTabIdsAtom,
} from "../../shared/lib/Atoms";
import type { NoteFile } from "../../shared/hooks/useFileTree";

export function useMobileSelectNote() {
  const setMobileView = useSetAtom(mobileViewAtom);
  const setNoteBackStack = useSetAtom(noteBackStackAtom);
  const setOpenTabIds = useSetAtom(openTabIdsAtom);
  const setActiveNoteId = useSetAtom(activeNoteIdAtom);

  return (note: NoteFile) => {
    setNoteBackStack([]);
    setOpenTabIds((prev) => (prev.includes(note.id) ? prev : [...prev, note.id]));
    setActiveNoteId(note.id);
    setMobileView("editor");
  };
}
