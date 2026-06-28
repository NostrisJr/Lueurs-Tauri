/**
 * useWikilinkCandidates.ts
 *
 * Filtre les notes du vault selon une requête, pour l'autocomplétion de wikilinks.
 * Partagé par WikilinkSuggest (popup `[[`) et WikilinkEditPopup (édition).
 */

import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { notesByIdAtom } from "../../../lib/atoms";
import { NoteType } from "../../../lib/noteTypes";

export interface WikilinkCandidate {
  id: string;
  /** Chemin relatif au vault, avec extension — la target stockée. */
  relpath: string;
  name: string;
}

const MAX_RESULTS = 8;

export function useWikilinkCandidates(
  query: string,
  vaultPath: string
): WikilinkCandidate[] {
  const notesById = useAtomValue(notesByIdAtom);

  return useMemo(() => {
    const prefix = vaultPath.endsWith("/") ? vaultPath : `${vaultPath}/`;
    const q = query.toLowerCase().trim();
    const list: Array<WikilinkCandidate & { rank: number }> = [];
    for (const note of notesById.values()) {
      if (note.type === NoteType.BASE) continue;
      if (!note.id.startsWith(prefix)) continue;
      const relpath = note.id.slice(prefix.length);
      const nameLc = note.name.toLowerCase();
      const relLc = relpath.toLowerCase();
      if (q) {
        const inName = nameLc.includes(q);
        const inRel = relLc.includes(q);
        if (!inName && !inRel) continue;
        const rank = nameLc.startsWith(q) ? 0 : inName ? 1 : 2;
        list.push({ id: note.id, relpath, name: note.name, rank });
      } else {
        list.push({ id: note.id, relpath, name: note.name, rank: 0 });
      }
    }
    list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
    return list.slice(0, MAX_RESULTS);
  }, [query, notesById, vaultPath]);
}
