import clsx from "clsx";
import { useState } from "react";
import { BottomSheet } from "../../../mobile/components/BottomSheet/BottomSheet";
import { PropertyModeFields } from "../../../shared/components/FrontmatterPicker/PropertyModeFields";
import type { NoteFile } from "../../../shared/hooks/useFileTree";
import { type Row, toPropertyOptions } from "./lib/frontmatterUtils";
import type { PropertyType, useValueEditor } from "./lib/useValueEditor";

interface TypeOption {
  value: PropertyType;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface Props {
  row: Row;
  rows: Row[];
  isTemplate: boolean;
  canRename: boolean;
  canConfigure: boolean;
  canDelete: boolean;
  typeOptions: TypeOption[];
  editor: ReturnType<typeof useValueEditor>;
  allNotes: NoteFile[];
  noteResolver: (path: string) => NoteFile | undefined;
  formulaVars: Record<string, unknown>;
  onRename: (oldKey: string, newKey: string) => void;
  onDelete: () => void;
}

/**
 * Bottom sheet unique de réglages d'une propriété libre (Texte/Nombre/Bouton)
 * sur mobile — remplace l'icône croix, l'icône roue et PropertyEditModal, qui
 * cumulaient 3 interactions séparées pour la même ligne. Porte aussi la
 * VALEUR elle-même (via PropertyModeFields, déjà utilisé par les tables et
 * les formules inline) : la ligne du frontmatter peut se retrouver masquée
 * sous cette sheet une fois ouverte (elle occupe jusqu'à 85% de l'écran),
 * donc l'éditer en place n'y est pas fiable — cf. FrontmatterValue, qui
 * n'affiche plus qu'un aperçu non interactif sur mobile pendant que cette
 * sheet est ouverte (le commit live déjà en place le tient à jour).
 *
 * Pas de prop `title` sur BottomSheet : avec `autoHeight`, elle ne mesure pas
 * la hauteur du titre (limitation documentée dans BottomSheet.tsx), ce qui
 * tronquait le bas du contenu (bouton Supprimer). Le nom de la propriété vit
 * donc dans le contenu mesuré — le champ de renommage en tient lieu quand il
 * est affiché (son édition le met à jour en direct), un simple libellé sinon.
 */
export function MobilePropertySheet({
  row,
  rows,
  isTemplate,
  canRename,
  canConfigure,
  canDelete,
  typeOptions,
  editor,
  allNotes,
  noteResolver,
  formulaVars,
  onRename,
  onDelete,
}: Props) {
  const [keyDraft, setKeyDraft] = useState(row.key);
  const trimmedKeyDraft = keyDraft.trim();
  const isKeyUnchanged = trimmedKeyDraft === row.key;
  const isKeyDuplicate =
    !isKeyUnchanged && rows.some((r) => r.key === trimmedKeyDraft);
  const canSaveKey =
    trimmedKeyDraft !== "" && !isKeyUnchanged && !isKeyDuplicate;

  function handleClose() {
    if (canRename && canSaveKey) onRename(row.key, trimmedKeyDraft);
    editor.commitAndClose();
  }

  return (
    <BottomSheet autoHeight onClose={handleClose}>
      <div className="px-4 pb-4 flex flex-col gap-3">
        {canRename ? (
          <div>
            <input
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ fontSize: 16 }}
              className={clsx(
                "w-full px-3 py-2 border rounded-lg outline-none transition-colors font-semibold",
                isKeyDuplicate
                  ? "border-danger-2 focus:border-danger-2"
                  : "border-line-2 focus:border-line-3"
              )}
            />
            {isKeyDuplicate && (
              <p className={clsx("text-sm mt-1 px-1", "text-danger-2")}>
                Ce nom est déjà utilisé.
              </p>
            )}
            {isTemplate && canSaveKey && (
              <p className={clsx("text-sm mt-1 px-1", "text-accent")}>
                Sera propagé à toutes les notes héritières.
              </p>
            )}
          </div>
        ) : (
          <p className="font-semibold px-1">
            {row.key.replace(/^__|__$/g, "")}
          </p>
        )}

        {canConfigure && (
          <PropertyModeFields
            modeOptions={typeOptions}
            mode={editor.draft.type}
            onModeChange={editor.handleTypeChange}
            text={editor.draft.text}
            onTextChange={(text) => editor.setDraft({ ...editor.draft, text })}
            numberDef={editor.draft.numberDef}
            onNumberDefChange={(numberDef) =>
              editor.setDraft({ ...editor.draft, numberDef })
            }
            numberFormatLocked={editor.numberFormatLocked}
            enumDef={editor.draft.enumDef}
            onEnumDefChange={(enumDef) =>
              editor.setDraft({ ...editor.draft, enumDef })
            }
            allNotes={allNotes}
            noteResolver={noteResolver}
            selfProperties={toPropertyOptions(
              Object.keys(formulaVars),
              row.key
            )}
            autoFocus
          />
        )}

        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className={clsx(
              "w-full px-3 py-2.5 rounded-xl font-medium transition-colors",
              "text-danger bg-danger-soft",
              "active:bg-danger-soft-2"
            )}
          >
            Supprimer la propriété
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
