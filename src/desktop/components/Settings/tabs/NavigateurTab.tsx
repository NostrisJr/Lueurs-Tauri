import { useAtom } from "jotai";
import {
  documentMapDistinguishedTypesAtom,
  documentMapShowListsAtom,
  documentMapShowNavigatorAtom,
  documentMapShowTextAtom,
} from "../../../../shared/lib/atoms";
import {
  ALL_MAP_BLOCK_TYPES,
  BLOCK_TYPE_COLORS,
  BLOCK_TYPE_LABELS,
} from "../../../../shared/lib/documentMapConfig";

export function NavigateurTab() {
  const [showNavigator, setShowNavigator] = useAtom(documentMapShowNavigatorAtom);
  const [showLists, setShowLists] = useAtom(documentMapShowListsAtom);
  const [showText, setShowText] = useAtom(documentMapShowTextAtom);
  const [distinguishedTypes, setDistinguishedTypes] = useAtom(documentMapDistinguishedTypesAtom);

  function toggleBlockType(type: string) {
    setDistinguishedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={showNavigator}
          onChange={() => setShowNavigator((v) => !v)}
          className="rounded accent-gray-800 cursor-pointer"
        />
        <span className="text-sm text-gray-700">Afficher le navigateur</span>
      </label>

      {showNavigator && (
        <>
          <div className="space-y-2 pl-1">
            <p className="text-xs text-gray-400">Contenu général</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLists}
                  onChange={() => setShowLists((v) => !v)}
                  className="rounded accent-gray-800 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Listes &amp; to-do</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showText}
                  onChange={() => setShowText((v) => !v)}
                  className="rounded accent-gray-800 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Texte</span>
              </label>
            </div>
          </div>

          <div className="space-y-2 pl-1">
            <p className="text-xs text-gray-400">
              Blocs à distinguer (les autres comptent comme du texte)
            </p>
            <div className="space-y-2">
              {ALL_MAP_BLOCK_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={distinguishedTypes.includes(type)}
                    onChange={() => toggleBlockType(type)}
                    className="rounded accent-gray-800 cursor-pointer"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: BLOCK_TYPE_COLORS[type] }}
                  />
                  <span className="text-sm text-gray-700">{BLOCK_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
