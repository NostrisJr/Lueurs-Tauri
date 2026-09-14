import clsx from "clsx";
import { useRef, useState } from "react";
import type { TableColumn } from "../../../../shared/hooks/useTable";

// PropertyEditModal est réutilisé tel quel depuis FrontmatterEditor
import { PropertyEditModal } from "../../Frontmatter/PropertyEditModal";

interface Props {
  columns: TableColumn[];
  titleColWidth: number;
  existingKeys: string[];
  onResizeStart: (key: string, e: React.PointerEvent) => void;
  onRenameColumn: (
    oldKey: string,
    newKey: string,
    templatePaths: string[]
  ) => void;
}

export function TableHeader({
  columns,
  titleColWidth,
  existingKeys,
  onResizeStart,
  onRenameColumn,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const anchorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    // Le fond blanc + pt-2 du conteneur sticky (plutôt qu'un simple top plus
    // grand sur le header lui-même) : un top-14 "nu" laisse un espace SANS
    // fond entre le NoteHeader et le header du tableau, à travers lequel les
    // lignes défilantes restent visibles. Ici le blanc opaque du conteneur
    // couvre cet espace tout en gardant l'accroche sticky au ras du NoteHeader.
    <div className={clsx("sticky top-12 z-10 pt-2", "bg-surface")}>
      <div
        className={clsx(
          "flex items-center border-b select-none rounded-t-lg",
          "border-line-2 bg-surface-3"
        )}
      >
        {/* Colonne titre — non renommable */}
        <div
          style={{ width: titleColWidth }}
          className={clsx(
            "relative border-r last:border-none px-3 py-2 text-xs font-semibold font-body truncate",
            "border-line-2 text-ink-3"
          )}
        >
          Titre
        </div>

        {columns.map((col) => (
          <div
            key={col.key}
            ref={(el) => {
              anchorRefs.current[col.key] = el;
            }}
            style={{ width: col.width }}
            className={clsx(
              "relative border-r last:border-none px-3 py-2 text-xs font-semibold font-body overflow-hidden",
              "border-line-2"
            )}
          >
            <span
              className={clsx(
                "cursor-pointer transition-colors truncate block",
                "text-ink-3",
                "hover:text-ink-4"
              )}
              onDoubleClick={() => setEditingKey(col.key)}
              title="Double-cliquer pour renommer"
            >
              {col.key}
            </span>

            {/* Poignée de resize */}
            <div
              className={clsx(
                "absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors",
                "hover:bg-accent-2"
              )}
              onPointerDown={(e) => onResizeStart(col.key, e)}
            />

            {editingKey === col.key && (
              <PropertyEditModal
                propKey={col.key}
                isTemplate
                existingKeys={existingKeys}
                anchorRef={{ current: anchorRefs.current[col.key] }}
                onClose={() => setEditingKey(null)}
                onRename={(oldKey, newKey) => {
                  onRenameColumn(oldKey, newKey, col.templatePaths);
                  setEditingKey(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
