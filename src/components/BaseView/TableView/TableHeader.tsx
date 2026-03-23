import { useRef, useState } from "react";
import type { TableColumn } from "../hooks/useTable";

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
    <div className="flex items-center border-b border-gray-200 bg-gray-50 sticky top-0 z-10 select-none">
      {/* Colonne titre — non renommable */}
      <div
        style={{ width: titleColWidth }}
        className="relative shrink-0 border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 font-body truncate"
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
          className="relative shrink-0 border-r border-gray-200 px-3 py-2 text-xs font-semibold truncate font-body"
        >
          <span
            className="text-amber-500/70 cursor-pointer hover:text-amber-600 transition-colors"
            onDoubleClick={() => setEditingKey(col.key)}
            title="Double-cliquer pour renommer"
          >
            {col.key}
          </span>

          {/* Poignée de resize */}
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-amber-300 transition-colors"
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
  );
}
