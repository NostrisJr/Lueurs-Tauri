import type { RefObject } from "react";
import type { useTable } from "../../../../shared/hooks/useTable";
import { CELL_WIDTH, TITLE_WIDTH } from "./constants";

interface Props {
  columns: ReturnType<typeof useTable>["columns"];
  /** Conteneur dont le scrollLeft est recopié depuis celui des lignes (cf. MobileBaseView). */
  scrollRef: RefObject<HTMLDivElement | null>;
}

/**
 * En-tête de colonnes — rendu dans le bloc sticky de MobileBaseView, donc hors
 * du scroller horizontal des lignes : un sticky vertical placé à l'intérieur de
 * celui-ci se résoudrait contre ce scroller (overflow-x: auto force
 * overflow-y: auto), qui ne défile jamais verticalement, et ne collerait donc
 * jamais. Le prix à payer est la recopie manuelle du scrollLeft.
 */
export function MobileTableHeader({ columns, scrollRef }: Props) {
  return (
    // overflow-hidden plutôt que auto : pas de défilement au doigt sur
    // l'en-tête, mais ça reste un scrollport — ce qui fait fonctionner le
    // sticky left-0 de la cellule "Titre" quand on pilote scrollLeft.
    <div
      ref={scrollRef}
      className="overflow-hidden bg-gray-50 border-b border-gray-200"
    >
      <div className="flex w-max min-w-full">
        <div
          className="shrink-0 sticky left-0 z-10 bg-gray-50 px-3 py-2.5 border-r border-gray-200"
          style={{ width: TITLE_WIDTH }}
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Titre
          </span>
        </div>
        {columns.map((col) => (
          <div
            key={col.key}
            className="shrink-0 px-3 py-2.5 border-r border-gray-200 last:border-none"
            style={{ width: CELL_WIDTH }}
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate block">
              {col.key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
