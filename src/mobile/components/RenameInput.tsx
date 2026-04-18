import { useEffect, useState } from "react";
import type { RenameTarget } from "../../shared/lib/Atoms";
import { createLogger } from "../../shared/lib/logger";
import { FloatingInput } from "./FloatingInput";

const log = createLogger("RenameInput");

interface Props {
  target: RenameTarget | null;
  onClose: () => void;
  onCommit: (id: string, newName: string, isFolder: boolean) => Promise<void>;
}

export function RenameInput({ target, onClose, onCommit }: Props) {
  const [draft, setDraft] = useState(target?.name ?? "");

  // Réinitialise le draft quand la cible change
  useEffect(() => {
    if (target) {
      log.info("nouveau target", { id: target.id, name: target.name });
      setDraft(target.name);
    }
  }, [target]);

  if (!target) return null;

  async function handleCommit() {
    // target est garanti non-null (guard if (!target) return null plus haut)
    const t = target;
    if (!t) return;
    const trimmed = draft.trim();
    if (trimmed && trimmed !== t.name) {
      log.info("commit rename", { id: t.id, newName: trimmed });
      await onCommit(t.id, trimmed, t.isFolder);
    }
    onClose();
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay tactile */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <FloatingInput
        value={draft}
        onChange={setDraft}
        onCommit={handleCommit}
        enterKeyHint="done"
        label={target.isFolder ? "Renommer le dossier" : "Renommer la note"}
        placeholder={target.name}
      />
    </>
  );
}
